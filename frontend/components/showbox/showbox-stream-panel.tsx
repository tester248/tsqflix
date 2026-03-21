"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, Play } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { VideoPlayer } from "@/components/video/video-player"
import { cn } from "@/lib/utils"

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
}

export const ShowboxStreamPanel: React.FC<ShowboxStreamPanelProps> = ({ title, type }) => {
  const apiBase = useMemo(() => API_BASE_URL, [])
  const searchType = type === "movie" ? "movie" : "tv"

  const [searchResults, setSearchResults] = useState<ShowboxResult[]>([])
  const [selectedResult, setSelectedResult] = useState<ShowboxResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [shareKey, setShareKey] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)

  const [files, setFiles] = useState<FebboxFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [pathStack, setPathStack] = useState<BreadcrumbItem[]>([{ id: 0, label: "Root" }])

  const [qualities, setQualities] = useState<FebboxQuality[]>([])
  const [qualitiesLoading, setQualitiesLoading] = useState(false)
  const [qualitiesError, setQualitiesError] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState<FebboxFile | null>(null)
  const [playerUrl, setPlayerUrl] = useState<string | null>(null)
  const [playerQualityTitle, setPlayerQualityTitle] = useState<string | null>(null)

  const currentParentId = pathStack[pathStack.length - 1]?.id ?? 0

  useEffect(() => {
    if (!apiBase || !title) return

    const controller = new AbortController()
    setIsSearching(true)
    setSearchError(null)
    fetch(`${apiBase}/api/search?type=${searchType}&title=${encodeURIComponent(title)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Search failed: ${res.statusText}`)
        return res.json()
      })
      .then((results: ShowboxResult[]) => {
        if (!controller.signal.aborted) {
          setSearchResults(results ?? [])
          setSelectedResult(results?.[0] ?? null)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setSearchError(err.message)
          setSearchResults([])
          setSelectedResult(null)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false)
        }
      })

    return () => controller.abort()
  }, [apiBase, searchType, title])

  useEffect(() => {
    if (!selectedResult || !apiBase) {
      setShareKey(null)
      return
    }

    const controller = new AbortController()
    setShareError(null)
    setShareKey(null)
    setFiles([])
    setPathStack([{ id: 0, label: "Root" }])
    setActiveFile(null)
    setQualities([])
    setPlayerUrl(null)
    setPlayerQualityTitle(null)

    const requestType = selectedResult.box_type || (type === "movie" ? 1 : 2)

    fetch(`${apiBase}/api/febbox/id?id=${selectedResult.id}&type=${requestType}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to resolve Febbox share: ${res.statusText}`)
        return res.json()
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setShareKey(data?.febBoxId ?? null)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setShareError(err.message)
        }
      })

    return () => controller.abort()
  }, [apiBase, selectedResult, type])

  useEffect(() => {
    if (!shareKey || !apiBase) return

    const controller = new AbortController()
    setFilesError(null)
    setFilesLoading(true)
    fetch(`${apiBase}/api/febbox/files?shareKey=${encodeURIComponent(shareKey)}&parent_id=${currentParentId}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load Febbox files: ${res.statusText}`)
        return res.json()
      })
      .then((data: FebboxFile[]) => {
        if (!controller.signal.aborted) {
          setFiles(data ?? [])
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setFilesError(err.message)
          setFiles([])
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setFilesLoading(false)
        }
      })

    return () => controller.abort()
  }, [apiBase, shareKey, currentParentId])

  const handleFolderClick = (file: FebboxFile) => {
    if (!file.is_dir) return
    setPathStack((stack) => [...stack, { id: file.fid, label: file.file_name }])
    setQualities([])
    setPlayerUrl(null)
    setPlayerQualityTitle(null)
    setActiveFile(null)
  }

  const handleBack = () => {
    if (pathStack.length <= 1) return
    setPathStack((stack) => stack.slice(0, -1))
    setQualities([])
    setPlayerUrl(null)
    setPlayerQualityTitle(null)
    setActiveFile(null)
  }

  const handleFileSelection = async (file: FebboxFile) => {
    if (!shareKey || !apiBase) return
    setActiveFile(file)
    setQualities([])
    setPlayerUrl(null)
    setPlayerQualityTitle(null)
    setQualitiesError(null)
    setQualitiesLoading(true)

    try {
      const res = await fetch(`${apiBase}/api/febbox/links?shareKey=${encodeURIComponent(shareKey)}&fid=${file.fid}`)
      if (!res.ok) throw new Error(`Failed to load link data: ${res.statusText}`)
      const data: FebboxQuality[] = await res.json()
      setQualities(data ?? [])
      if (data?.[0]?.url) {
        setPlayerUrl(data[0].url)
        setPlayerQualityTitle(data[0].quality ?? data[0].name ?? file.file_name)
      }
    } catch (err) {
      setQualitiesError(err instanceof Error ? err.message : "Failed to load qualities")
    } finally {
      setQualitiesLoading(false)
    }
  }

  const handleQualitySelect = (quality: FebboxQuality) => {
    if (!quality.url) return
    setPlayerUrl(quality.url)
    setPlayerQualityTitle(quality.quality ?? quality.name ?? activeFile?.file_name ?? title)
  }

  if (!apiBase) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Set NEXT_PUBLIC_TSQFLIX_API_URL in your environment to enable the Showbox/Febbox panel.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-background/70 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Febbox Streams
          </p>
          <h3 className="text-2xl font-semibold">Play {title}</h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{type}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
        <div className="space-y-4 rounded-2xl border bg-card/50 p-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Showbox search</p>
            <p className="text-xs text-muted-foreground">
              searching for {title} in {type}
            </p>
          </div>

          {isSearching && <p className="text-sm text-muted-foreground">Looking up Showbox results…</p>}
          {searchError && <p className="text-sm text-destructive">{searchError}</p>}

          <div className="grid gap-2">
            {searchResults.slice(0, 5).map((result) => (
              <button
                key={result.id}
                className={cn(
                  buttonVariants({ variant: selectedResult?.id === result.id ? "default" : "outline" }),
                  "justify-between"
                )}
                onClick={() => setSelectedResult(result)}
                type="button"
              >
                <span className="text-sm font-medium">{result.title}</span>
                <span className="text-xs text-muted-foreground">{result.year ?? "n/a"}</span>
              </button>
            ))}
          </div>

          {selectedResult && (
            <div className="space-y-1 rounded-xl border bg-background px-3 py-2 text-sm text-muted-foreground">
              <p className="text-sm font-medium text-foreground">{selectedResult.title}</p>
              {selectedResult.description && <p>{selectedResult.description}</p>}
              <p>Showbox ID: {selectedResult.id}</p>
            </div>
          )}

          {shareKey && (
            <p className="text-sm text-muted-foreground">
              Febbox share: <span className="font-mono text-foreground">{shareKey}</span>
            </p>
          )}
          {shareError && <p className="text-sm text-destructive">{shareError}</p>}
        </div>

        <div className="space-y-4 rounded-2xl border bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Files</p>
              <p className="text-xs text-muted-foreground">
                {pathStack.map((crumb) => crumb.label).join(" / ")}
              </p>
            </div>
            <button
              className={cn(buttonVariants({ variant: "ghost" }))}
              disabled={pathStack.length <= 1}
              onClick={handleBack}
              type="button"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </button>
          </div>

          {filesLoading && <p className="text-sm text-muted-foreground">Loading files…</p>}
          {filesError && <p className="text-sm text-destructive">{filesError}</p>}

          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.fid}
                className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground">{file.file_size}</p>
                </div>
                {file.is_dir ? (
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline" }))}
                    onClick={() => handleFolderClick(file)}
                  >
                    Open
                  </button>
                ) : (
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "ghost" }))}
                    onClick={() => handleFileSelection(file)}
                  >
                    <Play className="mr-1 h-4 w-4" /> Select
                  </button>
                )}
              </div>
            ))}
            {!filesLoading && !files.length && shareKey && (
              <p className="text-sm text-muted-foreground">No files found in this folder.</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Qualities</p>
              {qualitiesLoading && <span className="text-xs text-muted-foreground">Fetching links...</span>}
            </div>

            {qualitiesError && <p className="text-sm text-destructive">{qualitiesError}</p>}

            <div className="flex flex-wrap gap-2">
              {qualities.map((quality) => {
                const label = quality.quality || quality.name || "link"
                const isActive = quality.url === playerUrl
                return (
                  <button
                    key={`${quality.url}-${label}`}
                    type="button"
                    className={cn(buttonVariants({ variant: isActive ? "default" : "outline" }))}
                    onClick={() => handleQualitySelect(quality)}
                    disabled={!quality.url}
                  >
                    {label}
                    {quality.size && <span className="ml-2 text-[11px] text-muted-foreground">{quality.size}</span>}
                  </button>
                )
              })}
            </div>
            {!qualitiesLoading && !qualities.length && activeFile && (
              <p className="text-sm text-muted-foreground">No quality links available for this file.</p>
            )}
          </div>

          {playerUrl && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Player</p>
              <VideoPlayer url={playerUrl} title={playerQualityTitle ?? activeFile?.file_name} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}