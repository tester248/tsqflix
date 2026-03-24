export default class TorrentioAPI {
  constructor(env) {
    this.env = env;
    this.baseUrl = "https://torrentio.strem.fun";
  }

  /**
   * Fetches streams from Torrentio public API
   * @param {string} type 'movie' or 'series'
   * @param {string} id imdbId for movies, or imdbId:season:episode for series
   */
  async getStreams(type, id) {
    const url = `${this.baseUrl}/stream/${type}/${id}.json`;
    console.log(`Fetching Torrentio streams from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    if (!response.ok) {
      throw new Error(`Torrentio API failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.streams || [];
  }
}
