import CryptoJS from 'crypto-js';
import { customAlphabet } from 'nanoid';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
    BASE_URL: 'https://mbpapi.shegu.net/api/api_client/index/',
    APP_KEY: 'moviebox',
    APP_ID: 'com.tdo.showbox',
    IV: 'wEiphTn!',
    KEY: '123d6cedf626dy54233aa1w6',
    DEFAULTS: {
        CHILD_MODE: process.env.CHILD_MODE || '0',
        APP_VERSION: '11.5',
        LANG: 'en',
        PLATFORM: 'android',
        CHANNEL: 'Website',
        APPID: '27',
        VERSION: '129',
        MEDIUM: 'Website',
    },
};

const nanoid = customAlphabet('0123456789abcdef', 32);

class ShowboxAPI {
    constructor() {
        this.baseUrl = CONFIG.BASE_URL;
    }

    encrypt(data) {
        return CryptoJS.TripleDES.encrypt(
            data,
            CryptoJS.enc.Utf8.parse(CONFIG.KEY),
            { iv: CryptoJS.enc.Utf8.parse(CONFIG.IV) }
        ).toString();
    }

    generateVerify(encryptedData) {
        return CryptoJS.MD5(
            CryptoJS.MD5(CONFIG.APP_KEY).toString() + CONFIG.KEY + encryptedData
        ).toString();
    }

    getExpiryTimestamp() {
        return Math.floor(Date.now() / 1000 + 60 * 60 * 12);
    }

    async request(module, params = {}) {
        const requestData = {
            ...CONFIG.DEFAULTS,
            expired_date: this.getExpiryTimestamp(),
            module,
            ...params,
        };

        const encryptedData = this.encrypt(JSON.stringify(requestData));
        const body = JSON.stringify({
            app_key: CryptoJS.MD5(CONFIG.APP_KEY).toString(),
            verify: this.generateVerify(encryptedData),
            encrypt_data: encryptedData,
        });

        const formData = new URLSearchParams({
            data: Buffer.from(body).toString('base64'),
            appid: CONFIG.DEFAULTS.APPID,
            platform: CONFIG.DEFAULTS.PLATFORM,
            version: CONFIG.DEFAULTS.VERSION,
            medium: CONFIG.DEFAULTS.MEDIUM,
        });

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Platform': CONFIG.DEFAULTS.PLATFORM,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'okhttp/3.2.0',
            },
            body: `${formData.toString()}&token${nanoid()}`,
        });

        return response.json();
    }

    async search(title, type = 'all', page = 1, pagelimit = 20) {
        return this.request('Search5', { page, type, keyword: title, pagelimit }).then(data => {
            return data.data;
        });
    }

    async getMovieDetails(movieId) {
        return this.request('Movie_detail', { mid: movieId }).then(data => {
            return data.data;
        });
    }

    async getShowDetails(showId) {
        return this.request('TV_detail_v2', { tid: showId }).then(data => {
            return data.data;
        });
    }

    async getFebBoxId(id, type) {
        // Use the encrypted API to get the share link (avoids Cloudflare on showbox.media)
        const module = type == 1 ? 'Movie_s498Fdownload' : 'TV_sdownload';
        const params = type == 1 ? { mid: id } : { tid: id };
        try {
            const data = await this.request(module, params);
            if (data && typeof data.data === 'object' && data.data.link) {
                return data.data.link.split('/').pop();
            }
            console.log("Attempting corsproxy for ID", id);
            // Attempt 1: Direct JSON approach via Free Public CORS proxy that is trusted by Cloudflare
            try {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://www.showbox.media/index/share_link?id=${id}&type=${type}`)}`;
                const response = await fetch(proxyUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
                        'Origin': 'http://localhost:3000',
                        'Accept': 'application/json, text/html, */*'
                    }
                });
                const text = await response.text();
                
                try {
                    const json = JSON.parse(text);
                    if (json && json.data && json.data.link) {
                        return json.data.link.split('/').pop();
                    }
                } catch (e) {
                    // Not JSON, might be HTML
                    const match = text.match(/window\.location\.href\s*=\s*'([^']+)'/);
                    if (match) {
                        return match[1].split('/').pop();
                    }
                    const match2 = text.match(/share\/([a-zA-Z0-9_-]+)/);
                    if (match2) {
                        return match2[1];
                    }
                }
            } catch (e) {
                console.error("Proxy fetch failed:", e.message);
            }

            // Fallback: Original direct approach (which often gets blocked by Cloudflare on Vercel)
            const fallbackResponse = await fetch(`https://www.showbox.media/index/share_link?id=${id}&type=${type}`);
            const text = await fallbackResponse.text();

            const match = text.match(/window\.location\.href\s*=\s*'([^']+)'/);
            if (match) {
                return match[1].split('/').pop();
            }

            return null;
        } catch {
            return null;
        }
    }

    async getAutocomplete(keyword , pagelimit = 5) {
        return this.request('Autocomplate2', { keyword, pagelimit: pagelimit }).then(data => {
            return data.data;
        });
    }
}

export default ShowboxAPI;