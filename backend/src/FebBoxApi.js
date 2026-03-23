import * as cheerio from 'cheerio';

class FebboxAPI {
    constructor(env) {
        this.baseUrl = 'https://www.febbox.com';
        this.env = env || {};
        this.headers = this._getDefaultHeaders();
        this._setAuthCookie(this.env.FEBBOX_UI_COOKIE);
    }

    _setAuthCookie(cookie) {
        if (!cookie) return this;
        this.headers.cookie = `ui=${cookie}`;
        return this;
    }

    _getDefaultHeaders() {
        return {
            'x-requested-with': 'XMLHttpRequest',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        };
    }

    _setReferer(shareKey) {
        this.headers.referer = `${this.baseUrl}/share/${shareKey}`;
    }

    _buildHeaders(cookie = null) {
        return {
            ...this.headers,
            ...(cookie ? { cookie: `ui=${cookie}` } : {})
        };
    }

    async _fetchJson(url, cookie = null) {
        const response = await fetch(url, { headers: this._buildHeaders(cookie) });
        if (!response.ok) throw new Error(`Error fetching data from ${url}: ${response.statusText}`);
        return response.json();
    }

    async _fetchText(url, cookie = null) {
        const response = await fetch(url, { headers: this._buildHeaders(cookie) });
        if (!response.ok) throw new Error(`Error fetching data from ${url}: ${response.statusText}`);
        return response.text();
    }

    async getFileList(shareKey, parentId = 0 , cookie = null) {
        const url = `${this.baseUrl}/file/file_share_list?share_key=${shareKey}&pwd=&parent_id=${parentId}&is_html=0`;
        this._setReferer(shareKey);

        const data = await this._fetchJson(url , cookie);
        return data.data.file_list;
    }

    async getLinks(shareKey, fid , cookie = null) {
        const url = `${this.baseUrl}/console/video_quality_list?fid=${fid}`;
        this._setReferer(shareKey);

        const htmlResponse = await this._fetchText(url, cookie);

        let actualHtml = htmlResponse;
        try {
            const parsed = JSON.parse(htmlResponse);
            actualHtml = parsed.html || parsed.data || htmlResponse;
        } catch (e) {}

        const $ = cheerio.load(actualHtml);
        return this._extractFileQualities($);
    }

    _extractFileQualities($) {
        return $('.file_quality').map((_, el) => {
            const fileDiv = $(el);
            const url = fileDiv.attr('data-url');
            const quality = fileDiv.attr('data-quality');
            const name = fileDiv.find('.name').text().trim();
            const speed = fileDiv.find('.speed span').text().trim();
            const size = fileDiv.find('.size').text().trim();

            return { url, quality, name, speed, size };
        }).get();
    }
}

export default FebboxAPI;
