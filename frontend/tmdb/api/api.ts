import apiConfig from "./config"

type FetcherOptions = {
  endpoint: string
  params?: Record<string, string | undefined>
}

type Fetcher = <T>(options: FetcherOptions, init?: RequestInit) => Promise<T>

const sanitizeParams = (params?: Record<string, string | undefined>) => {
  return Object.fromEntries(
    Object.entries(params ?? {}).filter(([, value]) => value !== undefined)
  )
}

const createSearchParams = (params: Record<string, string | undefined>) => {
  const sanitizedParams = sanitizeParams(params)
  const mergedParams: Record<string, string> = {
    ...apiConfig.defaultParams,
    ...sanitizedParams,
  } as Record<string, string>

  return new URLSearchParams(mergedParams).toString()
}

// ─── In-memory cache (works on Edge, Node, and everywhere) ───────────────────
// Replaces the node:fs disk cache — Edge runtime has no filesystem.
// Cloudflare Workers isolates are long-lived per-PoP so this is still effective.
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours
const memCache = new Map<string, { data: string; expires: number }>()

const getCached = (key: string): string | null => {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    memCache.delete(key)
    return null
  }
  return entry.data
}

const setCache = (key: string, data: string) => {
  memCache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────
// Uses native fetch (available in Node 18+, Cloudflare Edge, browsers).
// Removed node:https TLS 1.2 workaround — that was only needed for Windows
// Node 22 local dev. Cloudflare/Vercel Linux build servers don't have this issue.
const fetchWithRetry = async (
  url: string,
  headers: Record<string, string>,
  retries = 3
): Promise<string> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err: any) {
      if (attempt === retries - 1) {
        throw new Error(
          `TMDB request failed after ${retries} attempts: ${url.split("?")[0]}`
        )
      }
      const delay = Math.min(5000, 500 * Math.pow(2, attempt))
      console.log(
        `[TMDB] Retry ${attempt + 1}/${retries} (wait ${delay}ms): ${err.message}`
      )
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error("Maximum retries reached")
}

const fetcher: Fetcher = async ({ endpoint, params }) => {
  const sanitizedParams = sanitizeParams(params)
  const _params = createSearchParams(sanitizedParams)
  const url = `${apiConfig.baseUrl}/${endpoint}?${_params}`

  const cached = getCached(url)
  if (cached) return JSON.parse(cached)

  const body = await fetchWithRetry(url, apiConfig.defaultHeaders)
  setCache(url, body)

  return JSON.parse(body)
}

export const api = {
  fetcher,
}
