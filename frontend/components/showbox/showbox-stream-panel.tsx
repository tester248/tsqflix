"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, Play, Share2, ShieldCheck, Zap, Download } from "lucide-react"

import { VideoPlayer } from "@/components/video/video-player"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/use-app-store"

const API_BASE_URL = process.env.NEXT_PUBLIC_TSQFLIX_API_URL?.replace(/\/$/, "") ?? ""

type ShowboxResult = {
  id: number
  title: string
  year?: number
  box_type: number
}

type FebboxFile = {
  fid: number
  file_name: string
  file_size?: string
  is_dir: number
}

type FebboxQuality = {
  url: string
  quality?: string
  name?: string
}

interface ShowboxStreamPanelProps {
  title: string
  tmdbId: string
  imdbId?: string
  type: "movie" | "tv"
  season?: number
  episode?: number
  poster?: string
  episodeTitle?: string
}

type SourceType = 'febbox' | 'torrentio' | 'vidsrc'

export const ShowboxStreamPanel: React.FC<ShowboxStreamPanelProps> = ({ 
  title, type, tmdbId, imdbId, season, episode, poster = "", episodeTitle = "" 
}) => {
  const apiBase = useMemo(() => API_BASE_URL, [])
  const { history, addHistory } = useAppStore()
  
  const initialStartTime = useMemo(() => {
    const entry = history.find(h => 
      h.id === tmdbId && h.season === season && h.episode === episode
    );
    return entry?.timestamp ?? 0;
  }, [history, tmdbId, season, episode]);

  const [activeSource, setActiveSource] = useState<SourceType>('febbox')
  const [playerUrl, setPlayerUrl] = useState<string | null>(null)
  const [playerTitle, setPlayerTitle] = useState<string>("")
  const [playerType, setPlayerType] = useState<'m3u8' | 'torrent'>('m3u8')

  // Showbox State
  const [sbResults, setSbResults] = useState<ShowboxResult[]>([])
  const [sbSelected, setSbSelected] = useState<ShowboxResult | null>(null)
  const [sbFiles, setSbFiles] = useState<FebboxFile[]>([])
  const [sbQualities, setSbQualities] = useState<FebboxQuality[]>([])
  const [loadingSb, setLoadingSb] = useState(false)
  
  // Torrentio State
  const [torrentStreams, setTorrentStreams] = useState<any[]>([])
  const [loadingTor, setLoadingTor] = useState(false)
  
  // VidSrc State
  const [vidsrcData, setVidsrcData] = useState<{ directUrl?: string, embedUrl?: string } | null>(null)
  const [loadingVid, setLoadingVid] = useState(false)

  // Initial Data Fetch
  useEffect(() => {
    if (!apiBase || !title) return
    const controller = new AbortController()

    // 1. Showbox Search
    setLoadingSb(true)
    fetch(`${apiBase}/api/search?type=${type === 'movie' ? 'movie' : 'tv'}&title=${encodeURIComponent(title)}`)
      .then(r => r.json())
      .then(data => {
          setSbResults(data || [])
          if (data?.length > 0) setSbSelected(data[0])
      })
      .finally(() => setLoadingSb(false))

    // 2. Torrentio Search (if imdbId exists)
    if (imdbId) {
      setLoadingTor(true)
      const torId = type === 'movie' ? imdbId : `${imdbId}:${season}:${episode}`
      fetch(`${apiBase}/api/torrentio?type=${type === 'movie' ? 'movie' : 'series'}&id=${torId}`)
        .then(r => r.json())
        .then(data => setTorrentStreams(data || []))
        .finally(() => setLoadingTor(false))
    }

    // 3. VidSrc Resolve
    setLoadingVid(true)
    fetch(`${apiBase}/api/vidsrc/resolve?type=${type}&tmdbId=${tmdbId}${season ? `&season=${season}` : ''}${episode ? `&episode=${episode}` : ''}`)
      .then(r => r.json())
      .then(data => setVidsrcData(data))
      .finally(() => setLoadingVid(false))

    return () => controller.abort()
  }, [apiBase, title, imdbId, type, season, episode, tmdbId])

  // Febbox File List Fetch
  useEffect(() => {
    if (!sbSelected || activeSource !== 'febbox') return
    
    const fetchFiles = async () => {
        try {
            const res = await fetch(`${apiBase}/api/febbox/id?id=${sbSelected.id}&type=${sbSelected.box_type}`)
            const { febBoxId } = await res.json()
            if (febBoxId) {
                const fr = await fetch(`${apiBase}/api/febbox/files?shareKey=${febBoxId}`)
                const files = await fr.json()
                setSbFiles(files || [])
            }
        } catch (e) { console.error(e) }
    }
    fetchFiles()
  }, [sbSelected, activeSource, apiBase])

  const selectFebboxFile = async (file: FebboxFile, shareKey: string) => {
    const res = await fetch(`${apiBase}/api/febbox/links?shareKey=${shareKey}&fid=${file.fid}`)
    const data = await res.json()
    if (data?.length > 0) {
        const best = data.find((q: any) => q.url?.includes('.m3u8')) || data[0]
        setPlayerUrl(best.url)
        setPlayerType('m3u8')
        setPlayerTitle(`${file.file_name} - ${best.quality || 'HD'}`)
        setSbQualities(data)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Video Section */}
      <div className="w-full">
        {playerUrl ? (
          <VideoPlayer 
            url={playerUrl}
            type={playerType}
            title={playerTitle || title}
            poster={poster}
            episodeTitle={episodeTitle}
            startTime={initialStartTime}
            onTimeUpdate={(t, d) => {
                addHistory({
                    id: tmdbId, title, poster, type, timestamp: t, duration: d, season, episode, episodeTitle
                })
            }}
          />
        ) : (
          <div className="aspect-video w-full rounded-2xl border border-white/10 bg-zinc-950 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="size-16 rounded-full bg-rose-600/10 flex items-center justify-center text-rose-500">
                <ShieldCheck className="size-8" />
            </div>
            <div className="max-w-xs">
                <h3 className="text-lg font-bold">Ready to Watch?</h3>
                <p className="text-sm text-zinc-500">Select a source from the panel below to begin streaming with premium features.</p>
            </div>
          </div>
        )}
      </div>

      {/* Sources & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Source Selector (Left/Top) */}
        <div className="lg:col-span-3 space-y-3">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Media Sources</p>
          <button 
            onClick={() => setActiveSource('febbox')}
            className={cn(
                "w-full flex items-center gap-3 p-4 rounded-xl border transition-all",
                activeSource === 'febbox' ? "bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/20" : "bg-white/5 border-transparent text-zinc-400 hover:bg-white/10 hover:border-white/10"
            )}
          >
            <ShieldCheck className="size-5" />
            <div className="text-left leading-tight">
                <p className="text-sm font-bold">Showbox</p>
                <p className="text-[10px] opacity-60">High-speed CDN</p>
            </div>
          </button>
          <button 
            onClick={() => setActiveSource('torrentio')}
            className={cn(
                "w-full flex items-center gap-3 p-4 rounded-xl border transition-all",
                activeSource === 'torrentio' ? "bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/20" : "bg-white/5 border-transparent text-zinc-400 hover:bg-white/10 hover:border-white/10"
            )}
          >
            <Zap className="size-5" />
            <div className="text-left leading-tight">
                <p className="text-sm font-bold">Torrentio</p>
                <p className="text-[10px] opacity-60">P2P Streaming</p>
            </div>
          </button>
          <button 
            onClick={() => setActiveSource('vidsrc')}
            className={cn(
                "w-full flex items-center gap-3 p-4 rounded-xl border transition-all",
                activeSource === 'vidsrc' ? "bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/20" : "bg-white/5 border-transparent text-zinc-400 hover:bg-white/10 hover:border-white/10"
            )}
          >
            <Share2 className="size-5" />
            <div className="text-left leading-tight">
                <p className="text-sm font-bold">VidSrc</p>
                <p className="text-[10px] opacity-60">Direct Resolution</p>
            </div>
          </button>
        </div>

        {/* Content Area (Right/Bottom) */}
        <div className="lg:col-span-9 rounded-2xl border border-white/10 bg-zinc-950/50 p-6 min-h-[300px]">
           {activeSource === 'febbox' && (
             <div className="space-y-6">
                {sbSelected ? (
                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <button onClick={() => setSbSelected(null)} className="flex items-center gap-2 text-xs font-bold text-rose-500 uppercase tracking-widest hover:text-rose-400">
                            <ChevronLeft className="size-4" /> Back to results
                         </button>
                         <span className="text-[10px] font-bold text-zinc-500 uppercase">{sbSelected.title}</span>
                      </div>
                      <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                         {sbFiles.map(f => (
                           <button 
                             key={f.fid} 
                             onClick={() => selectFebboxFile(f, "fixed_key_for_now")} // Logic needs Febbox ID handle
                             className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 hover:bg-white/10 transition-all text-left"
                           >
                              <div className="min-w-0 flex-1">
                                 <p className="text-sm font-bold line-clamp-1">{f.file_name}</p>
                                 <p className="text-[10px] text-zinc-500">{f.file_size || 'Unknown size'}</p>
                              </div>
                              <Play className="size-4 text-zinc-600" />
                           </button>
                         ))}
                      </div>
                   </div>
                ) : (
                   <div className="grid gap-3">
                      {loadingSb ? [1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl bg-white/5" />) : 
                        sbResults.map(r => (
                          <button key={r.id} onClick={() => setSbSelected(r)} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left">
                             <div className="size-10 rounded-lg bg-rose-600/20 text-rose-500 flex items-center justify-center font-bold">
                                {r.year || '?'}
                             </div>
                             <div>
                                <p className="text-sm font-bold">{r.title}</p>
                                <p className="text-[10px] text-zinc-500 uppercase">Provider: Showbox</p>
                             </div>
                          </button>
                        ))
                      }
                   </div>
                )}
             </div>
           )}

           {activeSource === 'torrentio' && (
             <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="size-4 text-emerald-500" />
                    <h4 className="text-sm font-bold uppercase tracking-widest">P2P Streams Found</h4>
                </div>
                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {loadingTor ? [1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl bg-emerald-500/5" />) : 
                      torrentStreams.map((s, i) => (
                        <button 
                          key={i} 
                          onClick={() => {
                              setPlayerUrl(s.url)
                              setPlayerType('torrent')
                              setPlayerTitle(s.title.split('\n')[0])
                          }}
                          className={cn(
                              "flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                              playerUrl === s.url ? "bg-emerald-600/10 border-emerald-500/50" : "bg-white/5 border-transparent hover:border-emerald-500/10 hover:bg-emerald-500/5"
                          )}
                        >
                           <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-bold line-clamp-1">{s.title.split('\n')[0]}</p>
                              <p className="text-[10px] text-zinc-500 uppercase font-medium">{s.name} • {s.title.split('\n').find((l: string) => l.includes('👤')) || "Standard Speed"}</p>
                           </div>
                           <Download className="size-5 text-emerald-500" />
                        </button>
                      ))
                    }
                    {torrentStreams.length === 0 && !loadingTor && (
                        <div className="py-12 text-center space-y-2 opacity-40">
                            <AlertTriangle className="size-12 mx-auto" />
                            <p className="text-sm font-medium">No P2P streams available for this title.</p>
                        </div>
                    )}
                </div>
             </div>
           )}

           {activeSource === 'vidsrc' && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                 {loadingVid ? <Skeleton className="h-32 w-full max-w-sm rounded-2xl bg-white/5" /> : (
                    <>
                       <div className="space-y-2">
                          <h4 className="text-xl font-bold italic tracking-tighter text-rose-500">VidSrc Resolution</h4>
                          <p className="text-sm text-zinc-500 max-w-xs">Premium direct resolution. Bypasses ads and plays in our unified ArtPlayer engine.</p>
                       </div>
                       <button 
                         onClick={() => {
                             const url = vidsrcData?.directUrl || vidsrcData?.embedUrl
                             if (url) {
                                 setPlayerUrl(url)
                                 setPlayerType('m3u8')
                                 setPlayerTitle("VidSrc Resolution - HD")
                             }
                         }}
                         className="px-8 py-3 rounded-xl bg-rose-600 text-white font-bold uppercase tracking-widest hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20"
                       >
                          Start Stream
                       </button>
                    </>
                 )}
              </div>
           )}
        </div>
      </div>
    </div>
  )
}