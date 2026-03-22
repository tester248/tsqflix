# TSQFLIX 🚀

TSQFLIX is a high-performance, resilient streaming platform that bridges the gap between **TMDB** media discovery and **Febbox/Showbox** premium storage. This workspace integrates a robust Node.js backend with a cutting-edge Next.js frontend to deliver a seamless, cinema-grade experience.

## 🌟 Key Features

### 💎 Premium Playback Experience
- **HLS Proxy + Segment Cache**: All HLS streams are routed through a local backend proxy that caches downloaded segments in memory. Seeks and stalls are served instantly — no CDN round-trips, no restarts from the beginning.
- **Calibrated Tone Mapping**: HDR10, Dolby Vision, and SDR Boost modes that correctly reduce highlight luminance before restoring contrast and color — the right order for proper SDR display correction.
- **Resilient Streaming**: HLS.js configured for VOD with deep buffering. Network errors no longer destroy the player session — retries are transparent.
- **Dynamic Quality Selection**: Seamlessly switch between resolutions with instant keyframe seeking.
- **Multi-Language Audio**: Automatic audio track detection and switching for multi-language HLS streams.
- **VidSrc Fullscreen**: Full fullscreen support for the VidSrc backup player via a dedicated browser-native button.

### 🛡️ Unmatched Resilience
- **Infinite Retry Engine**: TMDB requests now feature a 50-attempt auto-retry system with intelligent backoff.
- **Disaster Recovery UI**: A beautiful, custom connection-interrupted dashboard that automatically recovers your session when the network returns.
- **Failover Sources**: Integrated backup server support (VidSrc) for 100% uptime.

### 📺 Advanced Media Navigation
- **Series-First Navigation**: Optimized TV Show flow that lands users directly in the Seasons tab for intuitive browsing.
- **"Start Watching" Magic**: Intelligent buttons that track your progress and link directly to the correct episode.
- **Personal Library**: Persistent "Continue Watching" and "My List" features stored locally in your browser.

### ⚡ Performance Optimized
- **IPv4-First Resolution**: Resolved common Node.js/Windows DNS hanging issues for "instant-on" API response.
- **Smart Caching**: Local TMDB file-based caching to reduce API overhead and latency.
- **Clean Build System**: Automated `.next` cache purging to ensure every deployment is perfect.

## 🛠️ Getting Started

### 1. Prerequisites
- **Febbox**: You must have a valid Febbox account.
- **TMDB API Key**: Obtain one from [themoviedb.org](https://api.themoviedb.org).

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
TMDB_KEY=your_tmdb_api_key
NEXT_PUBLIC_TSQFLIX_API_URL=http://localhost:3000
FEBBOX_UI_COOKIE=your_febbox_cookie
```

### 3. Installation
From the workspace root:
```bash
# Install orchestrator helpers
npm install

# Install service dependencies
cd backend && npm install
cd ../frontend && npm install
```

### 4. Development & Production
```bash
# Start both services in Dev Mode
npm run dev

# Professional Production Build & Start
npm run build && npm start
```

## 🏗️ Architecture
- **`/backend`**: Express.js proxy for Showbox/Febbox APIs.
- **`/frontend`**: Next.js 14 (App Router) with Tailwind CSS, ArtPlayer, and TanStack Query.

---
*Built with ❤️ for the ultimate streaming experience.*