# tsqflix

This workspace brings together two open-source codebases so we can build a full streaming experience:

- `backend/` – the Showbox + Febbox API integration originally cloned from [badwinton/show_feb_box_api](https://github.com/badwinton/show_feb_box_api);
- `frontend/` – the TMDB-powered Next.js frontend forked from [oktay/movies](https://github.com/oktay/movies).

## Getting started

1. Copy your Febbox UI cookie into `./.env` (the backend reads `FEBBOX_UI_COOKIE`).
2. From the workspace root, install the orchestrator helper that can run both services:

	```bash
	npm install
	```
3. Install the backend and frontend dependencies once (you can rerun these if you ever delete `node_modules`):

	```bash
	cd backend && npm install
	cd ../frontend && npm install
	```
4. Add your TMDB key and the backend URL to the same root `./.env` file used by the backend. The orchestrator scripts load this file so both services get the same values (no need for `frontend/.env.local`).

	```bash
	TMDB_KEY=your-api-key
	NEXT_PUBLIC_TSQFLIX_API_URL=http://localhost:3000
	```
5. Run the combined dev script from the workspace root:

	```bash
	npm run dev
	```

	The root script starts the backend on port `3000` and the Next.js frontend on `FRONTEND_PORT` (defaults to `3001`). The two services share the same `.env`, which prevents conflicts and keeps the watch tab connected to the Showbox/F Febbox API on `NEXT_PUBLIC_TSQFLIX_API_URL`.

	Visit [http://localhost:3001](http://localhost:3001) to view the frontend while the backend remains on port 3000.

The frontend can then be wired to call the backend endpoints (search, movie/show details, Febbox files/links) so the shared TMDB + Febbox data powers the streaming UI.

## Credits

- Showbox/Febbox integration: [badwinton/show_feb_box_api](https://github.com/badwinton/show_feb_box_api)
- TMDB frontend: [oktay/movies](https://github.com/oktay/movies)