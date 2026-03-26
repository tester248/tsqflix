import { Hono } from 'hono'
import { cors } from 'hono/cors'
import ShowboxAPI from './ShowboxAPI.js'
import FebboxAPI from './FebBoxApi.js'
import TorrentioAPI from './TorrentioAPI.js'
import VidSrcAPI from './VidSrcAPI.js'

const app = new Hono()

app.use('*', cors())

const getApis = (c) => {
  return {
    showboxAPI: new ShowboxAPI(c.env),
    febboxAPI: new FebboxAPI(c.env),
    torrentioAPI: new TorrentioAPI(c.env),
    vidSrcAPI: new VidSrcAPI(c.env)
  }
}

app.get('/', (c) => c.text('TSQFLIX API is running on Cloudflare Workers!'))

app.get('/api/debug', (c) => {
    return c.json({
        cookie_length: c.env.FEBBOX_UI_COOKIE ? c.env.FEBBOX_UI_COOKIE.length : 0,
        cookie_value: c.env.FEBBOX_UI_COOKIE ? c.env.FEBBOX_UI_COOKIE.substring(0, 50) + "..." : "missing"
    })
})

app.get('/api/autocomplete', async (c) => {
    const { keyword, pagelimit } = c.req.query()
    try {
        const results = await getApis(c).showboxAPI.getAutocomplete(keyword, pagelimit);
        return c.json(results);
    } catch (error) {
        return c.json({ error: error.message }, 500);
    }
})

app.get('/api/search', async (c) => {
    let { type = 'all', title, page = 1, pagelimit = 20 } = c.req.query();
    
    // Convert common type strings to Showbox numeric types
    if (type === 'movie') type = '1';
    if (type === 'tv') type = '2';

    try {
        const results = await getApis(c).showboxAPI.search(title, type, page, pagelimit);
        return c.json(Array.isArray(results) ? results : []);
    } catch (error) {
        console.error('Search error:', error.message);
        return c.json([], 200); // Return empty array on failure to keep frontend stable
    }
})

app.get('/api/movie/:id', async (c) => {
    try {
        const movieDetails = await getApis(c).showboxAPI.getMovieDetails(c.req.param('id'));
        return c.json(movieDetails);
    } catch (error) {
        return c.json({ error: error.message }, 500);
    }
})

app.get('/api/show/:id', async (c) => {
    try {
        const showDetails = await getApis(c).showboxAPI.getShowDetails(c.req.param('id'));
        return c.json(showDetails);
    } catch (error) {
        return c.json({ error: error.message }, 500);
    }
})

app.get('/api/febbox/id', async (c) => {
    const { id, type } = c.req.query();
    try {
        const febBoxId = await getApis(c).showboxAPI.getFebBoxId(id, type);
        return c.json({ febBoxId });
    } catch (error) {
        return c.json({ error: error.message }, 500);
    }
})

app.get('/api/febbox/files', async (c) => {
    const { shareKey, parent_id = 0 } = c.req.query();
    const cookie = c.req.header('x-auth-cookie') || null;
    try {
        const files = await getApis(c).febboxAPI.getFileList(shareKey, parent_id , cookie);
        return c.json(Array.isArray(files) ? files : []);
    } catch (error) {
        console.error('Febbox files error:', error.message);
        return c.json([], 200);
    }
})

app.get('/api/febbox/links', async (c) => {
    const { shareKey, fid } = c.req.query();
    const cookie = c.req.header('x-auth-cookie') || null;
    try {
        const links = await getApis(c).febboxAPI.getLinks(shareKey, fid , cookie);
        return c.json(links);
    } catch (error) {
        return c.json({ error: error.message }, 500);
    }
})

app.get('/api/febbox/stream', async (c) => {
    const { type, title, releaseYear, season, episode } = c.req.query();
    const cookie = c.req.header('x-auth-cookie') || null;

    if (!title || !type) {
        return c.json({ error: 'Missing title or type' }, 400);
    }
    
    try {
        const apis = getApis(c);
        
        // 1. Search Showbox by Title
        const searchResults = await apis.showboxAPI.search(title, type === 'movie' ? 1 : 2, 1, 10);
        if (!searchResults || searchResults.length === 0) {
            return c.json({ error: 'Not found on Showbox' }, 404);
        }
        
        let show = searchResults.find(r => r.year == releaseYear) || searchResults[0];
        const showboxId = show.id;
        
        // 2. Get Febbox Share Key
        const shareKey = await apis.showboxAPI.getFebBoxId(showboxId, type === 'movie' ? 1 : 2);
        if (!shareKey) {
            return c.json({ error: 'No FeBox share key found' }, 404);
        }

        let targetFid = null;

        // 3. Find correct file
        if (type === 'movie') {
            const files = await apis.febboxAPI.getFileList(shareKey, 0, cookie);
            const videoFile = files.find(f => !f.is_dir && f.file_name.match(/\.(mp4|mkv|avi)$/i));
            if (!videoFile) return c.json({ error: 'No movie file found' }, 404);
            targetFid = videoFile.fid;
        } else {
            let rootFiles = await apis.febboxAPI.getFileList(shareKey, 0, cookie);
            
            // Sometimes it's nested in a single folder
            if (rootFiles.length === 1 && rootFiles[0].is_dir) {
                rootFiles = await apis.febboxAPI.getFileList(shareKey, rootFiles[0].fid, cookie);
            }
            
            const seasonStr = (season || '').toString();
            const epStr = (episode || '').toString();
            
            const sRegex = new RegExp(`(?<=^|[^a-z0-9])(s|season)\\s*0*${seasonStr}(?=[^a-z0-9]|$)`, 'i');
            const eRegex = new RegExp(`(?<=^|[^a-z0-9])(e|ep|episode)\\s*0*${epStr}(?=[^a-z0-9]|$)`, 'i');
            const sXejRegex = new RegExp(`s0*${seasonStr}e0*${epStr}`, 'i');
            const absEpRegex = new RegExp(`(?<=^|[^a-z0-9])0*${epStr}(?=[^a-z0-9]|\\.[a-z]{3}$)`, 'i');
            
            let seasonFolder = rootFiles.find(f => f.is_dir && sRegex.test(f.file_name));
            
            let epFiles = seasonFolder 
                ? await apis.febboxAPI.getFileList(shareKey, seasonFolder.fid, cookie)
                : rootFiles;

            const episodeFile = epFiles.find(f => !f.is_dir && f.file_name.match(/\.(mp4|mkv|avi)$/i) && (eRegex.test(f.file_name) || sXejRegex.test(f.file_name) || (!seasonFolder && absEpRegex.test(f.file_name))));
            
            if (!episodeFile) return c.json({ error: 'Episode file not found' }, 404);
            targetFid = episodeFile.fid;
        }

        // 4. Get Links
        const links = await apis.febboxAPI.getLinks(shareKey, targetFid, cookie);
        if (!links || links.length === 0) {
            return c.json({ error: 'No playable links found' }, 404);
        }

        return c.json({ links });
    } catch (error) {
        return c.json({ error: error.message }, 500);
    }
})

app.get('/api/torrentio', async (c) => {
    let { type, id } = c.req.query();
    try {
        // IDs for series come as tt...:1:1. Stremio expects 'series'
        if (type === 'tv') type = 'series';
        
        const streams = await getApis(c).torrentioAPI.getStreams(type, id);
        return c.json(Array.isArray(streams) ? streams : []);
    } catch (error) {
        console.error('Torrentio error:', error.message);
        return c.json([], 200);
    }
})

app.get('/api/vidsrc/resolve', async (c) => {
    const { type, tmdbId, season, episode } = c.req.query();
    try {
        const resolved = await getApis(c).vidSrcAPI.resolve(type, tmdbId, season, episode);
        return c.json(resolved);
    } catch (error) {
        return c.json({ error: error.message }, 500);
    }
})

const segmentCache = new Map();
const SEGMENT_TTL = 60 * 60 * 1000;
const SEGMENT_MAX = 300;

app.get('/api/hls-proxy', async (c) => {
    const targetUrl = c.req.query('url');
    if (!targetUrl) return c.text('Missing url param', 400);

    const isM3u8 = targetUrl.includes('.m3u8');

    if (!isM3u8 && segmentCache.has(targetUrl)) {
        const cached = segmentCache.get(targetUrl);
        if (Date.now() - cached.ts < SEGMENT_TTL) {
            c.header('Access-Control-Allow-Origin', '*');
            c.header('Content-Type', 'video/mp2t');
            c.header('X-Cache', 'HIT');
            return c.body(cached.buf);
        } else {
            segmentCache.delete(targetUrl);
        }
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135.0.0.0',
                'Referer': 'https://www.febbox.com/',
                'Origin': 'https://www.febbox.com',
            }
        });

        if (!response.ok) {
            return c.text('Upstream error', response.status);
        }

        const contentType = response.headers.get('content-type') || '';

        if (isM3u8) {
            const body = await response.text();
            const baseUrl = new URL(targetUrl);
            const proxyBase = `${new URL(c.req.url).origin}/api/hls-proxy?url=`;

            const rewritten = body.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return line;
                try {
                    const absoluteUrl = trimmed.startsWith('http')
                        ? trimmed
                        : new URL(trimmed, baseUrl).href;
                    return proxyBase + encodeURIComponent(absoluteUrl);
                } catch {
                    return line;
                }
            }).join('\n');

            return c.text(rewritten, 200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            });
        } else {
            const arrayBuffer = await response.arrayBuffer();
            
            if (segmentCache.size >= SEGMENT_MAX) {
                segmentCache.delete(segmentCache.keys().next().value);
            }
            segmentCache.set(targetUrl, { buf: arrayBuffer, ts: Date.now() });

            return c.body(arrayBuffer, 200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            });
        }
    } catch (err) {
        return c.text(err.message, 500);
    }
});

export default app
