"use client"

import { useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    Artplayer: any;
    Hls: any;
  }
}

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
  onQualityChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Dynamic script loader for ArtPlayer and Hls.js
    const loadScripts = async () => {
      if (window.Artplayer && window.Hls) {
        setIsLoaded(true);
        return;
      }

      const hlsScript = document.createElement("script");
      hlsScript.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
      document.head.appendChild(hlsScript);

      const artScript = document.createElement("script");
      artScript.src = "https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js";
      document.head.appendChild(artScript);

      await Promise.all([
        new Promise(r => hlsScript.onload = r),
        new Promise(r => artScript.onload = r)
      ]);
      
      setIsLoaded(true);
    };

    loadScripts();
  }, [])

  useEffect(() => {
    if (!isLoaded || !containerRef.current || !url || !window.Artplayer) return

    if (artRef.current) {
        artRef.current.destroy()
    }

    const art = new window.Artplayer({
      container: containerRef.current,
      url: url,
      title: title,
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
      moreVideoAttr: {
        crossOrigin: "anonymous",
        preload: "auto",
      },
      quality: qualities.map(q => ({
        default: q.url === url,
        html: q.label,
        url: q.url,
      })),
      controls: [
        {
          position: "right",
          html: '<span style="font-size: 10px; font-weight: bold; padding: 2px 6px; border: 1px solid #E11D48; border-radius: 4px; color: #E11D48;">HDR</span>',
          tooltip: "ACES Tone Mapping (Auto)",
          click: function (art: any) {
            const video = art.video
            const isToned = video.style.filter.includes("contrast")
            if (isToned) {
              video.style.filter = ""
              art.notice.show = "Tone Mapping: OFF (Original)"
            } else {
              // Synthetic ACES-like Tone Mapping for SDR displays
              video.style.filter = "contrast(1.18) saturate(1.35) brightness(1.08) sepia(0.02)"
              art.notice.show = "Tone Mapping: ON (Enhanced HDR-to-SDR)"
            }
          },
        },
      ],
      customType: {
        m3u8: function (video: any, url: any, art: any) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url
          } else if (window.Hls.isSupported()) {
            const hls = new window.Hls({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 90,
            })
            hls.loadSource(url)
            hls.attachMedia(video)
            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
              console.log("[HLS] Manifest parsed, attached to ArtPlayer")
            })
            hls.on(window.Hls.Events.ERROR, (event: any, data: any) => {
              if (data.fatal) {
                switch (data.type) {
                  case window.Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad()
                    break
                  case window.Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError()
                    break
                  default:
                    art.notice.show = "Fatal playback error: Reconnecting..."
                    hls.destroy()
                    break
                }
              }
            })
            art.on("destroy", () => hls.destroy())
          } else {
            art.notice.show = "Unsupported playback format: m3u8"
          }
        },
      },
    })

    if (onQualityChange) {
      art.on('video:url', (url: string) => {
        onQualityChange(url);
      });
    }

    artRef.current = art

    return () => {
      if (artRef.current) {
        artRef.current.destroy()
        artRef.current = null
      }
    }
  }, [isLoaded, url, qualities, title, poster])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-2xl ring-1 ring-white/10 transition-all duration-300 hover:ring-white/20">
      <div ref={containerRef} className="size-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
           <div className="flex flex-col items-center gap-4">
              <div className="size-10 rounded-full border-t-2 border-rose-600 animate-spin" />
              <p className="text-sm font-medium text-zinc-400">Loading Premium Player...</p>
           </div>
        </div>
      )}
      {isLoaded && title && (
         <div className="pointer-events-none absolute top-4 left-4 z-10 hidden bg-black/60 px-4 py-2 rounded-xl border border-white/10 backdrop-blur-lg md:block">
            <p className="text-xs font-semibold tracking-wider uppercase text-white/70">Source Ready</p>
            <p className="text-sm font-medium text-white line-clamp-1">{title}</p>
         </div>
      )}
    </div>
  )
}