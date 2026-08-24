# VisualBs4Scraper backend

Flask API that powers the [frontend](../front)'s live preview and asset loading. It has two jobs:

- **Fetch and bundle a page** for the picker's iframe preview — strips scripts, rewrites stylesheet/image/icon URLs to route back through this server (so the preview renders with its original styling without the browser needing to reach the source site directly), and parses with `html5lib` so the DOM matches what a real browser renders (implicit `<tbody>` in tables, etc. — see [`../front/src/lib/codegen.ts`](../front/src/lib/codegen.ts) for why that matters: the generated Python parses the same way).
- **Proxy individual assets** (stylesheets, images, icons) referenced by the bundled page.

## API

### `GET /api/fetch_website?website=<url>`

Fetches `url`, bundles it (see above), and returns the resulting HTML as the response body.

- `400` if `website` is missing, or the fetch fails (bad URL, connection error, non-2xx, etc.)

### `GET /api/proxy_asset?url=<absolute-url>`

Fetches `url` and streams it back with its original content type. CSS responses have their `url(...)` references rewritten to also go through this proxy.

- `400` if `url` is missing or not `http(s)://`
- `502` if the upstream fetch fails
- the upstream's status code if it responded with something other than `200`

## Run locally

Requires Python 3.10+.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python Controller/app.py
```

Serves on `http://0.0.0.0:5000` (i.e. reachable at `http://127.0.0.1:5000`, which is what the frontend calls).

**Debian/Ubuntu "ensurepip is not available" error:** some installs ship Python without the stdlib's `ensurepip` module, so `python3 -m venv` fails outright. Either install the matching venv package (`sudo apt install python3.<minor>-venv`) or work around it without root:

```bash
python3 -m venv --without-pip .venv
curl -sS https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py
.venv/bin/python3 /tmp/get-pip.py
.venv/bin/pip install -r requirements.txt
```

## Run with Docker

```bash
docker build -t visualbs4scraper-backend .
docker run --rm -p 5000:5000 visualbs4scraper-backend
```

Same `http://127.0.0.1:5000` from the host — the frontend doesn't need to know it's containerized.

## Known limitations

This is a local-dev tool, not hardened for public deployment:

- `PageBundler.py` hardcodes `BACKEND_ORIGIN = "http://127.0.0.1:5000"` to build proxy URLs — fine as long as the server is reached at that host:port (true for both plain local runs and the Docker mapping above), but it'll need to become configurable before deploying anywhere else.
- `/api/proxy_asset` fetches whatever `http(s)://` URL it's given, server-side, with no allowlist — acceptable for a tool that only you point at pages you choose, but an SSRF surface if ever exposed to untrusted callers.
- No auth, no rate limiting, CORS wide open (`origins: "*"`) on `/api/*`.
