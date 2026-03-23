"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    Artplayer: any;
    Hls: any;
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
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  title,
  poster,
  qualities = [],
  onQualityChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<any>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [isLoaded, setIsLoaded] = useState(false)
  const [activeTone, setActiveTone] = useState(0)
  const [audioTracks, setAudioTracks] = useState<{ label: string; index: number }[]>([])
  const [activeAudio, setActiveAudio] = useState(0)
  const [showToneMenu, setShowToneMenu] = useState(false)
  const [showAudioMenu, setShowAudioMenu] = useState(false)

  // ── Script loader ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadScripts = async () => {
      if (window.Artplayer && window.Hls) { setIsLoaded(true); return }
      const load = (src: string) => new Promise<void>(resolve => {
        const s = document.createElement("script")
        s.src = src
        s.onload = () => resolve()
        document.head.appendChild(s)
      })
      await Promise.all([
        load("https://cdn.jsdelivr.net/npm/hls.js@latest"),
        load("https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"),
      ])
      setIsLoaded(true)
    }
    loadScripts()
  }, [])

  // ── ArtPlayer init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !containerRef.current || !url || !window.Artplayer) return

    if (artRef.current) artRef.current.destroy()

    // Reset state for new URL
    setActiveTone(0)
    setAudioTracks([])
    setActiveAudio(0)

    const art = new window.Artplayer({
      container: containerRef.current,
      url,
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
      quality: qualities.map(q => ({ default: q.url === url, html: q.label, url: q.url })),
      customType: {
        m3u8: function (video: HTMLVideoElement, streamUrl: string, artInstance: any) {
          // Store video ref for our React overlay to target
          videoRef.current = video

          // Route all HLS requests through our backend proxy to bypass CORS
          const API_BASE = process.env.NEXT_PUBLIC_TSQFLIX_API_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
          const proxyUrl = (u: string) => `${API_BASE}/api/hls-proxy?url=${encodeURIComponent(u)}`

          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            // Safari native HLS - no proxy needed
            video.src = streamUrl
          } else if (window.Hls.isSupported()) {
            const hls = new window.Hls({
              enableWorker: true,
              // VOD-optimized (NOT lowLatencyMode which is for live streams)
              lowLatencyMode: false,
              // Deep buffer to handle slow CDN/network between segments
              maxBufferLength: 60,
              maxMaxBufferLength: 120,
              maxBufferSize: 60 * 1000 * 1000, // 60 MB
              maxBufferHole: 0.5,
              // Retry policy
              manifestLoadingMaxRetry: 6,
              manifestLoadingRetryDelay: 1000,
              levelLoadingMaxRetry: 6,
              levelLoadingRetryDelay: 1000,
              fragLoadingMaxRetry: 6,
              fragLoadingRetryDelay: 1000,
              // Send our proxy URL as loader
              xhrSetup: (xhr: XMLHttpRequest) => {
                xhr.withCredentials = false
              },
            })
            artInstance.hls = hls
            hls.loadSource(proxyUrl(streamUrl))
            hls.attachMedia(video)

            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
              if (hls.audioTracks.length > 1) {
                setAudioTracks(hls.audioTracks.map((t: any, i: number) => ({
                  label: t.name || `Track ${i + 1}`,
                  index: i,
                })))
                setActiveAudio(hls.audioTrack)
              }
            })

            let recoveryAttempted = 0
            hls.on(window.Hls.Events.ERROR, (_: any, data: any) => {
              console.warn(`[HLS] ${data.type} error (fatal=${data.fatal}):`, data.details)
              if (!data.fatal) return
              if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
                // Media errors (e.g. decode failure) — attempt recovery
                if (recoveryAttempted < 3) {
                  hls.recoverMediaError()
                  recoveryAttempted++
                } else {
                  artInstance.notice.show = "Playback Error — try a different resolution"
                }
              }
              // Network errors: do NOT destroy — HLS.js retry policy will re-request
              // segments automatically, and our proxy cache means retries are instant
            })

            artInstance.on("destroy", () => hls.destroy())
          } else {
            artInstance.notice.show = "Unsupported: m3u8"
          }
        },
      },
    })

    if (onQualityChange) {
      art.on("video:url", (u: string) => onQualityChange(u))
    }

    artRef.current = art

    return () => {
      artRef.current?.destroy()
      artRef.current = null
      videoRef.current = null
    }
  }, [isLoaded, url, qualities, title, poster, onQualityChange])

  // ── Tone mapping – direct DOM write ───────────────────────────────────────
  const applyTone = (idx: number) => {
    setActiveTone(idx)
    setShowToneMenu(false)
    // Target the <video> element directly via our ref
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
    <div className="relative aspect-video w-full rounded-2xl border bg-black shadow-2xl ring-1 ring-white/10">
      {/* ArtPlayer mount point */}
      <div ref={containerRef} className="size-full" />

      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="size-10 rounded-full border-t-2 border-rose-600 animate-spin" />
            <p className="text-sm font-medium text-zinc-400">Loading Premium Player...</p>
          </div>
        </div>
      )}

      {/* Source label */}
      {isLoaded && title && (
        <div className="pointer-events-none absolute top-4 left-4 z-10 hidden bg-black/60 px-4 py-2 rounded-xl border border-white/10 backdrop-blur-lg md:block">
          <p className="text-xs font-semibold tracking-wider uppercase text-white/70">Source Ready</p>
          <p className="text-sm font-medium text-white line-clamp-1">{title}</p>
        </div>
      )}

      {/* ── Custom React Controls overlay ─────────────────────────────────── */}
      {isLoaded && (
        <div
          className="absolute top-4 right-4 z-20 flex items-center gap-2"
          // prevent clicks on our overlay from bubbling to ArtPlayer
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Tone Mapping button ── */}
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
                    {i > 0 && <span className="ml-2 text-[9px] text-zinc-500 font-normal">{t.value.split(" ")[0]}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Audio Track button (only shown when multiple tracks exist) ── */}
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