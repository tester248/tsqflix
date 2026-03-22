import https from "node:https"
import apiConfig from "./config"

type FetcherOptions = {
  endpoint: string
  params?: Record<string, string | undefined>
}

type Fetcher = <T>(options: FetcherOptions, init?: RequestInit) => Promise<T>

/**
 * Sanitizes the given parameters by removing entries with undefined values.
 */
const sanitizeParams = (params?: Record<string, string | undefined>) => {
  return Object.fromEntries(
    Object.entries(params ?? {}).filter(([, value]) => value !== undefined)
  )
}

/**
 * Creates a URL search params string from the given parameters.
 * Merges default parameters from the API configuration with the provided parameters.
 */
const createSearchParams = (params: Record<string, string | undefined>) => {
  const sanitizedParams = sanitizeParams(params)
  const mergedParams: Record<string, string> = {
    ...apiConfig.defaultParams,
    ...sanitizedParams,
  } as Record<string, string>

  return new URLSearchParams(mergedParams).toString()
}

import fs from "node:fs"
import path from "node:path"

const CACHE_FILE = path.join(process.cwd(), ".tmdb_cache.json")
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours persistence!

const getCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8")
      return JSON.parse(data)
    }
  } catch (e) {}
  return {}
}

const saveCache = (cache: any) => {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
  } catch (e) {}
}

const getCached = (key: string): string | null => {
  const cache = getCache()
  const entry = cache[key]
  if (!entry) return null
  if (Date.now() > entry.expires) {
    delete cache[key]
    saveCache(cache)
    return null
  }
  return entry.data
}

const setCache = (key: string, data: string) => {
  const cache = getCache()
  cache[key] = { data, expires: Date.now() + CACHE_TTL }
  saveCache(cache)
}

/**
 * HTTPS agent that forces TLS 1.2 and limits concurrent connections.
 * Node 22 defaults to TLS 1.3 which gets ECONNRESET on some Windows setups.
 */
const agent = new https.Agent({
  keepAlive: false,
  maxSockets: 4,
  secureProtocol: "TLSv1_2_method",
})

/**
 * Makes an HTTPS GET request using Node's built-in https module.
 * Forces TLS 1.2 to bypass ECONNRESET with TLS 1.3 on Windows/Node 22.
 */
const httpsGet = (
  url: string,
  headers: Record<string, string>
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, agent, timeout: 5000 }, (res) => {
      const chunks: Uint8Array[] = []
      res.on("data", (chunk: Uint8Array) => chunks.push(chunk))
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
      res.on("error", (err) => {
        req.destroy()
        reject(err)
      })
    })

    req.on("timeout", () => {
      req.destroy()
      reject(new Error(`TMDB connection timed out: ${url.split("?")[0]}`))
    })

    req.on("error", (err) => {
      req.destroy()
      reject(err)
    })
    
    req.end()
  })
}

/**
 * Retries httpsGet with aggressive steady backoff (50 attempts).
 * Ensures the user NEVER sees an error screen for temporary network issues.
 */
const httpsGetWithRetry = async (
  url: string,
  headers: Record<string, string>,
  retries = 50
): Promise<string> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await httpsGet(url, headers)
    } catch (err: any) {
      if (attempt === retries - 1) {
        throw new Error(
          `TMDB request failed after ${retries} attempts: ${url.split("?")[0]}`
        )
      }
      const delay = Math.min(5000, 500 * Math.pow(2, attempt))
      console.log(`[TMDB] Retry ${attempt + 1}/${retries} for ${url.split("?")[0]} (Wait ${delay}ms) Error: ${err.message}`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error("Maximum retries reached")
}

/**
 * Fetches data from the specified TMDB endpoint.
 * Uses in-memory cache + Node's built-in https module with TLS 1.2 and retries.
 */
const fetcher: Fetcher = async ({ endpoint, params }) => {
  const sanitizedParams = sanitizeParams(params)
  const _params = createSearchParams(sanitizedParams)

  const url = `${apiConfig.baseUrl}/${endpoint}?${_params}`

  // Check cache first
  const cached = getCached(url)
  if (cached) return JSON.parse(cached)

  const body = await httpsGetWithRetry(url, apiConfig.defaultHeaders)

  // Cache the successful response
  setCache(url, body)

  return JSON.parse(body)
}

export const api = {
  fetcher,
}
