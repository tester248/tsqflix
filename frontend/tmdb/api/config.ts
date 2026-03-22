/**
 * Configuration for the TMDB API.
 *
 * Defines the base URL for all API requests, default headers including content type,
 * and default parameters such as the API key.
 */

/**
 * The base URL for the TMDB API.
 * @type {string}
 */
const baseUrl: string = "https://api.themoviedb.org/3"

/**
 * Default headers for API requests.
 * @type {Record<string, string>}
 */
const defaultHeaders: Record<string, string> = {
  "Content-Type": "application/json",
}

/**
 * Default parameters for API requests.
 * Includes the v3 API key so it is appended to every request URL automatically.
 * @type {Record<string, string>}
 */
const defaultParams: Record<string, string> = {
  api_key: process.env.TMDB_KEY || "",
}

/**
 * The aggregated API configuration object.
 * Combines the baseUrl, defaultHeaders, and defaultParams into a single object for export.
 * @type {{ baseUrl: string, defaultHeaders: Record<string, string>, defaultParams: Record<string, string> }}
 */
const apiConfig: {
  baseUrl: string
  defaultHeaders: Record<string, string>
  defaultParams: Record<string, string>
} = {
  baseUrl,
  defaultHeaders,
  defaultParams,
}

export default apiConfig
