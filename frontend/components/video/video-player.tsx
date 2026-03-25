"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    Artplayer: any;
    Hls: any;
    WebTorrent: any;
  }
}

// Tone mapping presets — order matters: pull highlights down first, then restore contrast/color
const TONE_MAPS = [
  { label: "Normal",        value: "" },
  //  HDR10: highlights are clipped ~2-3 stops high. Reduce brightness, restore contrast + chroma.
  { label: "HDR10 Fix",    value: "brightness(0.78) contrast(1.35) saturate(1.55)" },
  //  DV: more aggressive highlight roll-off needed, stronger color pass
  { label: "Dolby Vision", value: "brightness(0.70) contrast(1.45) saturate(1.65)" },
  //  SDR Boost: just a mild grade for SDR content that looks flat
  { label: "SDR Boost",    value: "brightness(1.0) contrast(1.12) saturate(1.25)" },
]

interface VideoPlayerProps {
  url: string
  title?: string
  poster?: string
  qualities?: { label: string; url: string }[]
  onQualityChange?: (url: string) => void
  type?: "m3u8" | "torrent" | "embed"
  episodeTitle?: string
  startTime?: number
  onTimeUpdate?: (time: number, duration: number) => void
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  type,
  title,
  episodeTitle,
  poster,
  qualities = [],
  onQualityChange,
  startTime = 0,
  onTimeUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<any>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [isLoaded, setIsLoaded] = useState(false)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [activeTone, setActiveTone] = useState(0)
  const [audioTracks, setAudioTracks] = useState<{ label: string; index: number }[]>([])
  const [activeAudio, setActiveAudio] = useState(0)
  const [showToneMenu, setShowToneMenu] = useState(false)
  const [showAudioMenu, setShowAudioMenu] = useState(false)

  // ── Script loader ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadScripts = async () => {
      if (window.Artplayer && window.Hls && window.WebTorrent) { 
        setIsLoaded(true); 
        return; 
      }
      
      const load = (src: string) => new Promise<void>(resolve => {
        const s = document.createElement("script")
        s.src = src
        s.async = true
        s.onload = () => resolve()
        document.head.appendChild(s)
      })

      try {
        await Promise.all([
          load("https://cdn.jsdelivr.net/npm/hls.js@latest"),
          load("https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"),
          // Use a more stable bundle URL for webtorrent
          load("https://cdn.jsdelivr.net/npm/webtorrent@1.9.7/dist/webtorrent.min.js"),
        ])
        setIsLoaded(true)
      } catch (e) {
        console.error("Script loading failed", e)
      }
    }
    loadScripts()
  }, [])

  // ── ArtPlayer init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !containerRef.current || !url || !window.Artplayer || type === "embed") return

    if (artRef.current) artRef.current.destroy()

    // Reset state for new URL
    setActiveTone(0)
    setAudioTracks([])
    setActiveAudio(0)
    setIsVideoReady(false)

    const art = new window.Artplayer({
      container: containerRef.current,
      url,
      type: type || "",
      title,
      poster: poster || "",
      volume: 0.7,
      isLive: false,
      muted: false,
      autoplay: true,
      pip: true,
      autoSize: false,
      autoMini: true,
      screenshot: true,
      setting: true,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      fastSeek: true,
      lockTime: true,
      autoPlayback: true,
      autoOrientation: true,
      airplay: true,
      theme: "#E11D48",
      moreVideoAttr: { crossOrigin: "anonymous", preload: "auto" },
      quality: qualities && Array.isArray(qualities) ? qualities.map(q => ({ default: q.url === url, html: q.label, url: q.url })) : [],
      customType: {
        m3u8: function (video: HTMLVideoElement, streamUrl: string, artInstance: any) {
          videoRef.current = video
          const API_BASE = process.env.NEXT_PUBLIC_TSQFLIX_API_URL?.replace(/\/$/, "") ?? ""
          const proxyUrl = (u: string) => `${API_BASE}/api/hls-proxy?url=${encodeURIComponent(u)}`

          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = streamUrl
            setIsVideoReady(true)
          } else if (window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls({
              enableWorker: true,
              xhrSetup: (xhr: XMLHttpRequest) => { xhr.withCredentials = false },
            })
            artInstance.hls = hls
            hls.loadSource(proxyUrl(streamUrl))
            hls.attachMedia(video)

            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
              setIsVideoReady(true)
              if (hls.audioTracks.length > 1) {
                setAudioTracks(hls.audioTracks.map((t: any, i: number) => ({
                  label: t.name || `Track ${i + 1}`,
                  index: i,
                })))
                setActiveAudio(hls.audioTrack)
              }
            })
            artInstance.on("destroy", () => hls.destroy())
          }
        },
        torrent: function (video: HTMLVideoElement, magnet: string, artInstance: any) {
          videoRef.current = video
          if (!window.WebTorrent) {
            artInstance.notice.show = "WebTorrent not loaded"
            return
          }
          const client = new window.WebTorrent()
          artInstance.on("destroy", () => client.destroy())
          artInstance.notice.show = "Connecting to P2P network..."
          client.add(magnet, (torrent: any) => {
            const file = torrent.files.find((f: any) => f.name.match(/\.(mp4|mkv|avi|webm)$/i))
            if (file) {
              artInstance.notice.show = `Streaming: ${file.name}`
              file.renderTo(video, { autoplay: true, muted: false }, () => {
                setIsVideoReady(true)
              })
            }
          })
          client.on("error", (err: any) => {
            console.error("[WebTorrent Error]", err)
            artInstance.notice.show = `P2P Error: ${err.message}`
          })
        }
      },
    })

    if (onQualityChange) {
      art.on("video:url", (u: string) => onQualityChange(u))
    }

    if (onTimeUpdate) {
      art.on("video:timeupdate", () => {
        onTimeUpdate(art.currentTime, art.duration)
      })
    }

    art.on("ready", () => {
      if (startTime > 0) {
        art.currentTime = startTime
      }
    })

    artRef.current = art
    return () => {
      artRef.current?.destroy()
      artRef.current = null
      videoRef.current = null
    }
  }, [isLoaded, url, qualities, title, poster, type])

  // ── Tone mapping – direct DOM write ───────────────────────────────────────
  const applyTone = (idx: number) => {
    setActiveTone(idx)
    setShowToneMenu(false)
    const video = videoRef.current ?? containerRef.current?.querySelector("video")
    if (video) video.style.filter = TONE_MAPS[idx].value
  }

  // ── Audio track switch ─────────────────────────────────────────────────────
  const applyAudio = (idx: number) => {
    setActiveAudio(idx)
    setShowAudioMenu(false)
    if (artRef.current?.hls) artRef.current.hls.audioTrack = idx
  }

  return (
    <div className="relative aspect-video w-full rounded-2xl border bg-black shadow-2xl ring-1 ring-white/10 overflow-hidden">
      {/* Embed Mode */}
      {type === "embed" ? (
        <iframe 
          src={url} 
          className="size-full border-0" 
          allowFullScreen 
          allow="autoplay; encrypted-media; picture-in-picture"
          onLoad={() => setIsVideoReady(true)}
        />
      ) : (
        <div ref={containerRef} className="size-full" />
      )}

      {/* Loading overlay */}
      {( (!isLoaded || !isVideoReady) ) && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="size-10 rounded-full border-t-2 border-rose-600 animate-spin" />
            <p className="text-sm font-medium text-zinc-400 font-mono tracking-tighter">
                {!isLoaded ? "Setting up engine..." : "Verifying stream source..."}
            </p>
          </div>
        </div>
      )}

      {/* Source label */}
      {isLoaded && isVideoReady && title && (
        <div className="pointer-events-none absolute top-4 left-4 z-10 hidden bg-black/60 px-4 py-2 rounded-xl border border-white/10 backdrop-blur-lg md:block">
          <p className="text-xs font-semibold tracking-wider uppercase text-white/70">Source Ready</p>
          <p className="text-sm font-medium text-white line-clamp-1">{title}</p>
        </div>
      )}

      {/* Custom React Controls overlay */}
      {isLoaded && isVideoReady && type !== "embed" && (
        <div
          className="absolute top-4 right-4 z-20 flex items-center gap-2"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          {/* Tone Mapping */}
          <div className="relative">
            <button
              onClick={() => { setShowToneMenu(v => !v); setShowAudioMenu(false) }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all",
                activeTone > 0
                  ? "bg-rose-600 border-rose-500 text-white shadow-[0_0_12px_rgba(225,29,72,0.5)]"
                  : "bg-black/70 border-white/20 text-white/80 hover:bg-white/10"
              )}
            >
              <span>🎨</span>
              <span>{TONE_MAPS[activeTone].label}</span>
              <span className="opacity-50">{showToneMenu ? "▲" : "▼"}</span>
            </button>

            {showToneMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden z-30">
                {TONE_MAPS.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => applyTone(i)}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors",
                      activeTone === i
                        ? "bg-rose-600/80 text-white"
                        : "text-zinc-300 hover:bg-white/10"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Audio Tracks */}
          {audioTracks.length > 1 && (
            <div className="relative">
              <button
                onClick={() => { setShowAudioMenu(v => !v); setShowToneMenu(false) }}
                className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/80 transition-all hover:bg-white/10"
              >
                <span>🔊</span>
                <span>{audioTracks[activeAudio]?.label ?? "Audio"}</span>
                <span className="opacity-50">{showAudioMenu ? "▲" : "▼"}</span>
              </button>

              {showAudioMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden z-30">
                  {audioTracks.map((t) => (
                    <button
                      key={t.index}
                      onClick={() => applyAudio(t.index)}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors",
                        activeAudio === t.index
                          ? "bg-rose-600/80 text-white"
                          : "text-zinc-300 hover:bg-white/10"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}