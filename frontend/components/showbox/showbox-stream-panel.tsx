"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, Play, RotateCcw, Search, Share2, ShieldCheck, Zap } from "lucide-react"

import { VideoPlayer } from "@/components/video/video-player"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/use-app-store"

const API_BASE_URL = process.env.NEXT_PUBLIC_TSQFLIX_API_URL?.replace(/\/$/, "") ?? ""

type ShowboxResult = {
  id: number
  title: string
  year?: number
  description?: string
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
  size?: string
  speed?: string
}

interface BreadcrumbItem {
  id: number
  label: string
}

interface ShowboxStreamPanelProps {
  title: string
  tmdbId: string
  type: "movie" | "tv"
  season?: number
  episode?: number
}

type LoadingPhase = 'idle' | 'searching' | 'resolving' | 'fetching_files' | 'getting_links' | 'ready'

export const ShowboxStreamPanel: React.FC<ShowboxStreamPanelProps> = ({ title, type, tmdbId, season, episode }) => {
  const apiBase = useMemo(() => API_BASE_URL, [])
  const searchType = type === "movie" ? "movie" : "tv"
  const { addHistory } = useAppStore()

  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('idle')
  const [loadingProgress, setLoadingProgress] = useState(0)

  const [searchResults, setSearchResults] = useState<ShowboxResult[]>([])
  const [selectedResult, setSelectedResult] = useState<ShowboxResult | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [shareKey, setShareKey] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)

  const [files, setFiles] = useState<FebboxFile[]>([])
  const [filesError, setFilesError] = useState<string | null>(null)
  const [pathStack, setPathStack] = useState<BreadcrumbItem[]>([{ id: 0, label: "Root" }])

  const [qualities, setQualities] = useState<FebboxQuality[]>([])
  const [qualitiesLoading, setQualitiesLoading] = useState(false)
  const [qualitiesError, setQualitiesError] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState<FebboxFile | null>(null)
  const [playerUrl, setPlayerUrl] = useState<string | null>(null)
  const [playerQualityTitle, setPlayerQualityTitle] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<'febbox' | 'vidsrc'>('febbox')

  const currentParentId = pathStack[pathStack.length - 1]?.id ?? 0

  const handleFileSelect = async (file: FebboxFile) => {
    if (file.is_dir) {
      setPathStack(stack => [...stack, { id: file.fid, label: file.file_name }])
      return
    }

    setActiveFile(file)
    setQualitiesLoading(true)
    setQualitiesError(null)

    try {
      const res = await fetch(`${apiBase}/api/febbox/links?shareKey=${encodeURIComponent(shareKey!)}&fid=${file.fid}`)
      const data: FebboxQuality[] = await res.json()
      setQualities(data ?? [])
      
      const hlsStream = data.find(q => q.url?.includes('.m3u8'))
      const bestStream = hlsStream || data[0]
      
      if (bestStream?.url) {
        setPlayerUrl(bestStream.url)
        setPlayerQualityTitle(`${file.file_name} - ${bestStream.quality || bestStream.name}`)
        setSourceType('febbox')
        
        addHistory({
          id: tmdbId,
          title: title,
          poster: "", 
          type: type,
          timestamp: 0,
          duration: 0
        })
      }
    } catch (err) {
      setQualitiesError("Failed to load playback links.")
    } finally {
      setQualitiesLoading(false)
    }
  }

  // 1. Search Logic
  useEffect(() => {
    if (!apiBase || !title) return
    const controller = new AbortController()
    setLoadingPhase('searching')
    setLoadingProgress(15)
    
    fetch(`${apiBase}/api/search?type=${searchType}&title=${encodeURIComponent(title)}`, { signal: controller.signal })
      .then(res => res.json())
      .then(results => {
        if (!controller.signal.aborted) {
          setSearchResults(results ?? [])
          setSelectedResult(results?.[0] ?? null)
          setLoadingProgress(35)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) setSearchError(err.message)
      })
    return () => controller.abort()
  }, [apiBase, searchType, title])

  // 2. Resolve Share ID logic
  useEffect(() => {
    if (!selectedResult || !apiBase) return
    const controller = new AbortController()
    setLoadingPhase('resolving')
    setLoadingProgress(50)
    
    const requestType = selectedResult.box_type || (type === "movie" ? 1 : 2)
    fetch(`${apiBase}/api/febbox/id?id=${selectedResult.id}&type=${requestType}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (!controller.signal.aborted) {
          setShareKey(data?.febBoxId ?? null)
          setLoadingProgress(70)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setShareError(err.message)
          setLoadingPhase('ready')
        }
      })
    return () => controller.abort()
  }, [apiBase, selectedResult, type])

  // 3. Fetch Files logic
  useEffect(() => {
    if (!shareKey || !apiBase) return
    const controller = new AbortController()
    setLoadingPhase('fetching_files')
    setLoadingProgress(85)

    fetch(`${apiBase}/api/febbox/files?shareKey=${encodeURIComponent(shareKey)}&parent_id=${currentParentId}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (!controller.signal.aborted) {
          setFiles(data ?? [])
          setLoadingPhase('ready')
          setLoadingProgress(100)
          
          if (currentParentId === 0 && data?.length > 0) {
            if (type === "tv" && season) {
              const seasonFolder = data.find((f: any) => f.is_dir && (
                f.file_name.toLowerCase().includes(`season ${season}`) || 
                f.file_name.toLowerCase().includes(`s${String(season).padStart(2, '0')}`)
              ))
              if (seasonFolder) {
                handleFileSelect(seasonFolder)
                return
              }
            }

            const epPattern = episode ? `(s${String(season).padStart(2, '0')}e${String(episode).padStart(2, '0')}|${season}x${String(episode).padStart(2, '0')}|e${String(episode).padStart(2, '0')}|^${episode}\\s|\\s${episode}\\.|\\(${episode}\\))` : ""
            const episodeRegex = episode ? new RegExp(epPattern, 'i') : null
            
            const targetFile = data.find((f: any) => {
              const isVideo = f.file_name.match(/\.(mp4|mkv|avi|webm|m3u8)$/i)
              if (!isVideo) return false
              if (!episodeRegex) return true 
              return episodeRegex.test(f.file_name)
            }) || data.find((f: any) => f.file_name.match(/\.(mp4|mkv|avi|webm|m3u8)$/i)) || data[0]

            if (targetFile) handleFileSelect(targetFile)
          }
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) setFilesError(err.message)
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, shareKey, currentParentId, season, episode, type])

  const handleVidSrcSelect = () => {
    setSourceType('vidsrc')
    setPlayerUrl(`https://vidsrc.me/embed/${type}?tmdb=${tmdbId}`)
    setPlayerQualityTitle(`${title} - HD Backup`)
  }

  const statusMap = {
    idle: "Waiting...",
    searching: `Searching for "${title}"...`,
    resolving: "Bypassing Cloudflare protection...",
    fetching_files: "Accessing media library...",
    getting_links: "Extracting high-speed links...",
    ready: "Ready for playback"
  }

  return (
    <section className="space-y-6 rounded-3xl border bg-zinc-950/50 p-6 backdrop-blur-xl shadow-2xl overflow-hidden">
      {loadingPhase !== 'ready' && (
        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-zinc-500">
             <div className="flex items-center gap-2">
                <RotateCcw className="size-3 animate-spin text-rose-500" />
                <span>{statusMap[loadingPhase]}</span>
             </div>
             <span>{loadingProgress}%</span>
          </div>
          <Progress value={loadingProgress} className="h-1.5" />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-6">
           <div className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-400">
                 <Search className="size-4" />
                 <h3 className="text-sm font-bold uppercase tracking-widest">Sources</h3>
              </div>
              
              <div className="space-y-2">
                 <button 
                   onClick={() => setSourceType('febbox')}
                   className={cn(
                     "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-300 text-left",
                     sourceType === 'febbox' ? "bg-rose-500/10 border-rose-500/50 text-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.1)]" : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-900"
                   )}
                 >
                    <div className="flex items-center gap-3">
                       <ShieldCheck className="size-5" />
                       <span className="font-semibold text-xs">Febbox (Premium)</span>
                    </div>
                    {loadingPhase !== 'ready' && <Zap className="size-4 animate-pulse text-zinc-500" />}
                 </button>

                 <button 
                   onClick={handleVidSrcSelect}
                   className={cn(
                     "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-300 text-left",
                     sourceType === 'vidsrc' ? "bg-rose-500/10 border-rose-500/50 text-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.1)]" : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-900"
                   )}
                 >
                    <div className="flex items-center gap-3">
                       <Share2 className="size-5" />
                       <span className="font-semibold text-xs">VidSrc (Backup)</span>
                    </div>
                 </button>
              </div>
           </div>

            {Array.isArray(searchResults) && searchResults.length > 1 && (
               <div className="space-y-3 pt-4 border-t border-white/5">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Alternate Search</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                     {searchResults.map(res => (
                        <button 
                          key={res.id}
                          onClick={() => setSelectedResult(res)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors",
                            selectedResult?.id === res.id ? "bg-white/10 text-white font-bold" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                          )}
                        >
                           {res.title} ({res.year})
                        </button>
                     ))}
                  </div>
               </div>
            )}
        </div>

        <div className="lg:col-span-8 space-y-6">
           {sourceType === 'febbox' ? (
              <>
                {playerUrl ? (
                   <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center gap-2">
                            <Play className="size-4 text-rose-500 fill-rose-500" />
                            <span className="text-xs font-bold text-zinc-200 uppercase tracking-widest leading-none">STREAMING PLAYER</span>
                         </div>
                      </div>
                      <VideoPlayer 
                        url={playerUrl} 
                        title={playerQualityTitle || ""} 
                        qualities={qualities.map(q => ({ label: String(q.quality || q.name || "HD"), url: q.url }))}
                        onQualityChange={(url) => setPlayerUrl(url)}
                      />
                   </div>
                ) : (
                   <div className="aspect-video w-full rounded-2xl border border-white/5 bg-zinc-900/50 flex flex-col items-center justify-center gap-4 text-zinc-500">
                      {loadingPhase === 'ready' ? (
                         <>
                            <AlertTriangle className="size-12 opacity-20" />
                            <p className="text-sm font-medium">Select a file below to start streaming</p>
                         </>
                      ) : (
                         <>
                            <div className="size-12 rounded-full border-t-2 border-rose-500 animate-spin" />
                            <p className="text-sm font-bold animate-pulse">{statusMap[loadingPhase]}</p>
                         </>
                      )}
                   </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                   <div className="space-y-3 rounded-2xl bg-zinc-900/30 p-4 border border-white/5">
                      <div className="flex items-center justify-between">
                         <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Files</p>
                         {pathStack.length > 1 && (
                            <button onClick={() => setPathStack(s => s.slice(0, -1))} className="text-[10px] flex items-center gap-1 text-rose-500 hover:underline">
                               <ChevronLeft className="size-3" /> Back
                            </button>
                         )}
                      </div>
                      <div className="space-y-1 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                         {loadingPhase !== 'ready' ? [1,2,3].map(i => <Skeleton key={i} className="h-10 w-full mb-1" />) : 
                           Array.isArray(files) && files.map(f => (
                             <button
                               key={f.fid}
                               onClick={() => handleFileSelect(f)}
                               className={cn(
                                 "w-full text-left px-3 py-2 rounded-lg text-[11px] flex justify-between items-center transition-colors",
                                 activeFile?.fid === f.fid ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                               )}
                             >
                                <span className="line-clamp-1 flex-1">{f.file_name}</span>
                                {f.is_dir ? <ChevronLeft className="size-3 rotate-180 opacity-50 ml-2" /> : <Play className="size-2.5 ml-2 opacity-50" />}
                             </button>
                           ))
                         }
                      </div>
                   </div>

                   <div className="space-y-3 rounded-2xl bg-zinc-900/30 p-4 border border-white/5">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Resolutions</p>
                      <div className="flex flex-wrap gap-2">
                         {qualitiesLoading ? [1,2].map(i => <Skeleton key={i} className="h-8 w-20" />) : 
                           Array.isArray(qualities) && qualities.map(q => (
                             <button
                               key={q.url}
                               onClick={() => setPlayerUrl(q.url)}
                               className={cn(
                                 "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                                 playerUrl === q.url ? "bg-rose-500 border-rose-500 text-white shadow-lg" : "bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                               )}
                             >
                                {q.quality || q.name}
                             </button>
                           ))
                         }
                         {!qualities?.length && !qualitiesLoading && activeFile && <p className="text-[10px] text-zinc-600">No alternate links</p>}
                      </div>
                   </div>
                </div>
              </>
           ) : (
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Zap className="size-4 text-emerald-500 fill-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">Backup Server Active</span>
                     </div>
                     <button
                       onClick={() => {
                         const iframe = document.getElementById("vidsrc-iframe") as HTMLIFrameElement | null
                         if (iframe?.requestFullscreen) {
                           iframe.requestFullscreen()
                         } else if ((iframe as any)?.webkitRequestFullscreen) {
                           (iframe as any).webkitRequestFullscreen()
                         }
                       }}
                       className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 text-[11px] font-bold text-zinc-300 uppercase tracking-wider hover:bg-zinc-700 hover:text-white transition-all"
                     >
                       ⛶ Fullscreen
                     </button>
                  </div>
                  <div className="relative aspect-video w-full rounded-2xl border border-white/5 bg-black shadow-2xl">
                     <iframe
                       id="vidsrc-iframe"
                       src={playerUrl || ""}
                       className="absolute inset-0 size-full border-0 rounded-2xl"
                       allowFullScreen={true}
                       allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer"
                       referrerPolicy="no-referrer"
                     />
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                     <p className="text-xs text-emerald-500/80 leading-relaxed font-medium">
                        Note: VidSrc uses third-party servers. We recommend an <b>Ad-Blocker</b> for this backup source.
                     </p>
                  </div>
               </div>
            )}
        </div>
      </div>
    </section>
  )
}