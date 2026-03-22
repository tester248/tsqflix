import express from 'express';
import cors from 'cors'; // Import cors package
import ShowboxAPI from './ShowboxAPI.js';
import FebboxAPI from './FebBoxApi.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.API_PORT || 3000;

// Enable CORS for all origins
app.use(cors());

// OR manually set CORS headers if you don’t want to use `cors` package
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Allow requests from any domain
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // Allowed methods
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// Middleware to handle JSON requests
app.use(express.json());

// Initialize APIs
const showboxAPI = new ShowboxAPI();
const febboxAPI = new FebboxAPI();

// Test endpoint
app.get('/', (req, res) => {
    res.send('Showbox and Febbox API is working!');
});

app.get('/api/debug', (req, res) => {
    res.json({
        cookie_length: process.env.FEBBOX_UI_COOKIE ? process.env.FEBBOX_UI_COOKIE.length : 0,
        cookie_value: process.env.FEBBOX_UI_COOKIE ? process.env.FEBBOX_UI_COOKIE.substring(0, 50) + "..." : "missing"
    });
});

app.get('/api/debug2', async (req, res) => {
    try {
        const url = `https://www.febbox.com/console/video_quality_list?fid=2636650`;
        const response = await fetch(url, { headers: { cookie: `ui=${process.env.FEBBOX_UI_COOKIE}`, 'x-requested-with': 'XMLHttpRequest', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36', referer: `https://www.febbox.com/share/fNBTg8at` } });
        const text = await response.text();
        res.send(text);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Autocomplete endpoint
app.get('/api/autocomplete', async (req, res) => {
    const { keyword, pagelimit } = req.query;
    try {
        const results = await showboxAPI.getAutocomplete(keyword, pagelimit);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search endpoint
app.get('/api/search', async (req, res) => {
    const { type = 'all', title, page = 1, pagelimit = 20 } = req.query;
    try {
        const results = await showboxAPI.search(title, type, page, pagelimit);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Movie details
app.get('/api/movie/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const movieDetails = await showboxAPI.getMovieDetails(id);
        res.json(movieDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Show details
app.get('/api/show/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const showDetails = await showboxAPI.getShowDetails(id);
        res.json(showDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get FebBox ID
app.get('/api/febbox/id', async (req, res) => {
    const { id, type } = req.query;
    try {
        const febBoxId = await showboxAPI.getFebBoxId(id, type);
        res.json({ febBoxId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Febbox files
app.get('/api/febbox/files', async (req, res) => {
    const { shareKey, parent_id = 0 } = req.query;
    const cookie = req.headers['x-auth-cookie'] || null;
    try {
        const files = await febboxAPI.getFileList(shareKey, parent_id , cookie);
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get download links
app.get('/api/febbox/links', async (req, res) => {
    const { shareKey, fid } = req.query;
    const cookie = req.headers['x-auth-cookie'] || null;
    try {
        const links = await febboxAPI.getLinks(shareKey, fid , cookie);
        res.json(links);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── HLS Proxy + Segment Cache ────────────────────────────────────────────
// Segments are immutable so we cache them in memory for fast re-requests
const segmentCache = new Map(); // url -> { buf: Buffer, ts: number }
const SEGMENT_TTL = 60 * 60 * 1000; // 1 hour
const SEGMENT_MAX = 300;             // ~300 segments ≈ up to ~1.5 GB at 4K

app.get('/api/hls-proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url param');

    const isM3u8 = targetUrl.includes('.m3u8');

    // Serve binary segments from cache if available
    if (!isM3u8 && segmentCache.has(targetUrl)) {
        const cached = segmentCache.get(targetUrl);
        if (Date.now() - cached.ts < SEGMENT_TTL) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'video/mp2t');
            res.setHeader('X-Cache', 'HIT');
            return res.end(cached.buf);
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
            console.error(`[HLS Proxy] Failed to fetch ${targetUrl}: ${response.status}`);
            return res.status(response.status).send('Upstream error');
        }

        const contentType = response.headers.get('content-type') || '';
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Content-Type', contentType);

        const isM3u8 = targetUrl.includes('.m3u8') || contentType.includes('mpegurl');

        if (isM3u8) {
            // Rewrite all URIs in the manifest to go through our proxy
            const body = await response.text();
            const baseUrl = new URL(targetUrl);
            const proxyBase = `${req.protocol}://${req.get('host')}/api/hls-proxy?url=`;

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

            res.send(rewritten);
        } else {
            // Binary segment – cache then serve
            const buf = Buffer.from(await response.arrayBuffer());

            // Evict oldest if cache full
            if (segmentCache.size >= SEGMENT_MAX) {
                segmentCache.delete(segmentCache.keys().next().value);
            }
            segmentCache.set(targetUrl, { buf, ts: Date.now() });

            res.end(buf);
        }
    } catch (err) {
        console.error(`[HLS Proxy] Error: ${err.message}`);
        res.status(500).send(err.message);
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
