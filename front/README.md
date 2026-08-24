# VisualBs4Scraper — frontend

React + TypeScript + Vite app for VisualBs4Scraper. Paste a URL, pick elements on the
live-rendered page, and get back a working `requests` + `BeautifulSoup` Python script.
See the [repo root README](../README.md) for the full picture and the [backend README](../backend/README.md)
for the API this talks to.

## What's in here

```
src/
  pages/Landing.tsx              landing page ("/")
  Layouts/HomeLayout.tsx         shared chrome for the workspace ("/search")
  components/
    Header.tsx                   top bar
    SearchBar.tsx                URL input, live preview iframe, element-picking logic
    FunctionBuilderPanel.tsx     function builder UI + generated-code panel
  lib/
    selector.ts                  DOM element -> CSS selector (incl. group/list-item logic)
    codegen.ts                   functions list -> BeautifulSoup Python source
  types/builder.ts               shared types for the function-builder state
```

Routing is two pages (`react-router`): `/` (Landing) and `/search` (the actual tool).

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev
```

Serves on `http://localhost:5173`. It expects the [backend](../backend) running at
`http://127.0.0.1:5000` (hardcoded in `SearchBar.tsx` — see the backend README's
"Known limitations" for why, and what it'd take to change).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Typecheck (`tsc -b`) + production build to `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Serve the `dist/` build locally, for a quick sanity check |

## Run with Docker

```bash
docker build -t visualbs4scraper-frontend .
docker run --rm -p 8080:80 visualbs4scraper-frontend
```

This is a production-style build (multi-stage: `npm run build` under Node, then the
static `dist/` output served by nginx) — not the dev server. Open
`http://localhost:8080`; it still needs the backend reachable at
`http://127.0.0.1:5000` from your browser, same as running locally.
