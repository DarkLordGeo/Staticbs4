// Turns the same picked functions codegen.ts uses for a standalone script
// into a small, independently deployable REST API service instead: Flask +
// SQLAlchemy, "scrape once (or on a schedule), serve from a database" —
// crawl_db.py populates a table, app.py serves it over HTTP. Every List
// function becomes a queryable "source"; a single generic table (one row
// per scraped item, its fields as a JSON blob) avoids having to invent a
// SQL schema per site.

import type { FnGroup, PaginationConfig } from '../types/builder'
import { generateScraperModule, pyStr } from './codegen'

// The page-walking loop is the same shape as codegen.ts's genCrawlMain, just
// building DB-bound rows instead of one merged dict — kept separate rather
// than shared, since "write rows for a source" and "build a results dict"
// are different enough shapes that sharing would mean threading flags
// through the exact same three-way (url_pattern / link / single-page)
// branch codegen.ts already has to maintain on its own terms.
const genCrawlDef = (paginationConfig: PaginationConfig | null, paginationFnName: string | null): string => {
    if (paginationConfig === null) {
        return [
            'def crawl():',
            '    """Run every list function once against the single configured page."""',
            '    soup = fetch_soup()',
            '    return {name: fn(soup) for name, fn in LIST_FUNCTIONS.items()}',
        ].join('\n')
    }

    if (paginationConfig.mode === 'url_pattern') {
        return [
            `URL_TEMPLATE = ${pyStr(paginationConfig.urlTemplate)}`,
            `START_PAGE = ${paginationConfig.startPage}`,
            `END_PAGE = ${paginationConfig.endPage}`,
            '',
            '',
            'def crawl():',
            '    """Step through URL_TEMPLATE from START_PAGE to END_PAGE (inclusive),',
            '    running every list function on each page and accumulating results."""',
            '    results = {name: [] for name in LIST_FUNCTIONS}',
            '    for page in range(START_PAGE, END_PAGE + 1):',
            '        url = URL_TEMPLATE.format(page=page)',
            '        soup = fetch_soup(url)',
            '        for name, fn in LIST_FUNCTIONS.items():',
            '            results[name].extend(fn(soup))',
            '    return results',
        ].join('\n')
    }

    return [
        'MAX_PAGES = 20',
        '',
        '',
        'def crawl(start_url=URL, max_pages=MAX_PAGES):',
        '    """Follow the picked "next page" link, running every list function',
        '    on each page visited and accumulating results."""',
        '    url = start_url',
        '    pages = 0',
        '    results = {name: [] for name in LIST_FUNCTIONS}',
        '    while url and pages < max_pages:',
        '        soup = fetch_soup(url)',
        '        for name, fn in LIST_FUNCTIONS.items():',
        '            results[name].extend(fn(soup))',
        `        next_href = ${paginationFnName}(soup)`,
        '        url = urljoin(url, next_href) if next_href else None',
        '        pages += 1',
        '    return results',
    ].join('\n')
}

const genModelsPy = (): string => [
    '# pip install flask-sqlalchemy',
    'from datetime import datetime, timezone',
    '',
    'from flask_sqlalchemy import SQLAlchemy',
    '',
    'db = SQLAlchemy()',
    '',
    '',
    'class Record(db.Model):',
    '    """One row per scraped item. `source` is the list function it came',
    '    from (e.g. "get_items"); `data` holds that item\'s fields as JSON —',
    '    a single generic table instead of one bespoke table per site."""',
    '',
    '    __tablename__ = "records"',
    '',
    '    id = db.Column(db.Integer, primary_key=True)',
    '    source = db.Column(db.String(120), nullable=False, index=True)',
    '    data = db.Column(db.JSON, nullable=False)',
    '    scraped_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)',
    '',
    '    def to_dict(self):',
    '        return {"id": self.id, "source": self.source, "scraped_at": self.scraped_at.isoformat(), **self.data}',
].join('\n') + '\n'

const genAppPy = (): string => [
    '# pip install flask flask-sqlalchemy',
    'import os',
    '',
    'from flask import Flask, jsonify, request',
    '',
    'from models import Record, db',
    '',
    'DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///data.db")',
    '',
    '',
    'def create_app():',
    '    app = Flask(__name__)',
    '    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL',
    '    db.init_app(app)',
    '    with app.app_context():',
    '        db.create_all()',
    '',
    '    @app.get("/api/sources")',
    '    def list_sources():',
    '        """Which list functions have data, and how many rows each."""',
    '        rows = db.session.query(Record.source, db.func.count(Record.id)).group_by(Record.source).all()',
    '        return jsonify({source: count for source, count in rows})',
    '',
    '    @app.get("/api/<source>")',
    '    def list_records(source):',
    '        page = request.args.get("page", 1, type=int)',
    '        per_page = min(request.args.get("per_page", 50, type=int), 500)',
    '        query = Record.query.filter_by(source=source).order_by(Record.id)',
    '        total = query.count()',
    '        items = query.offset((page - 1) * per_page).limit(per_page).all()',
    '        return jsonify({',
    '            "source": source, "page": page, "per_page": per_page, "total": total,',
    '            "items": [r.to_dict() for r in items],',
    '        })',
    '',
    '    @app.get("/api/<source>/<int:record_id>")',
    '    def get_record(source, record_id):',
    '        record = Record.query.filter_by(source=source, id=record_id).first()',
    '        if record is None:',
    '            return jsonify({"error": "not found"}), 404',
    '        return jsonify(record.to_dict())',
    '',
    '    @app.post("/api/crawl")',
    '    def trigger_crawl():',
    '        """Re-run the scraper and replace stored data. Synchronous — fine',
    '        for a small site; for a large crawl, run crawl_db.py as a',
    '        scheduled job (cron / systemd timer / GitHub Actions) instead of',
    '        hitting this endpoint, so a slow crawl doesn\'t tie up a request."""',
    '        from crawl_db import run_crawl',
    '        counts = run_crawl(app)',
    '        return jsonify({"status": "ok", "counts": counts})',
    '',
    '    return app',
    '',
    '',
    'app = create_app()',
    '',
    'if __name__ == "__main__":',
    '    app.run(host="0.0.0.0", port=5001, debug=True)',
].join('\n') + '\n'

const genCrawlDbPy = (functions: FnGroup[], names: Map<string, string>): string => {
    const listFns = functions.filter(fn => fn.config.category === 'list')
    const paginationFn = functions.find(fn => fn.config.category === 'pagination')
    const paginationConfig: PaginationConfig | null =
        paginationFn && paginationFn.config.category === 'pagination' ? paginationFn.config : null
    const scraperImports = functions
        .filter(fn => !(fn.config.category === 'pagination' && fn.config.mode === 'url_pattern'))
        .map(fn => names.get(fn.id)!)

    const listFunctionsBlock = [
        'LIST_FUNCTIONS = {',
        ...listFns.map(fn => `    ${pyStr(names.get(fn.id)!)}: ${names.get(fn.id)},`),
        '}',
    ].join('\n')

    const needsUrljoin = paginationConfig !== null && paginationConfig.mode === 'link'

    return [
        '# pip install requests beautifulsoup4 html5lib flask flask-sqlalchemy',
        needsUrljoin ? 'from urllib.parse import urljoin' : null,
        '',
        `from scraper import URL, fetch_soup, ${scraperImports.join(', ')}`,
        'from app import create_app',
        'from models import Record, db',
        '',
        '',
        listFunctionsBlock,
        '',
        '',
        genCrawlDef(paginationConfig, paginationFn ? names.get(paginationFn.id)! : null),
        '',
        '',
        'def run_crawl(app=None):',
        '    """Run every list function across all configured pages, and replace',
        '    each source\'s stored rows with the freshly scraped ones — makes',
        '    re-running idempotent instead of accumulating duplicates forever."""',
        '    app = app or create_app()',
        '    results = crawl()',
        '    with app.app_context():',
        '        counts = {}',
        '        for source, items in results.items():',
        '            Record.query.filter_by(source=source).delete()',
        '            for item in items:',
        '                db.session.add(Record(source=source, data=item))',
        '            counts[source] = len(items)',
        '        db.session.commit()',
        '    return counts',
        '',
        '',
        'if __name__ == "__main__":',
        '    for source, count in run_crawl().items():',
        '        print(f"{source}: {count} rows")',
    ].filter((l): l is string => l !== null).join('\n') + '\n'
}

const genRequirementsTxt = (): string =>
    ['flask', 'flask-sqlalchemy', 'requests', 'beautifulsoup4', 'html5lib', ''].join('\n')

const genDockerfile = (): string => [
    'FROM python:3.12-slim',
    'WORKDIR /app',
    'COPY requirements.txt .',
    'RUN pip install --no-cache-dir -r requirements.txt',
    'COPY . .',
    'ENV DATABASE_URL=sqlite:////app/data/data.db',
    'RUN mkdir -p /app/data',
    'EXPOSE 5001',
    'CMD ["python", "app.py"]',
    '',
].join('\n')

const genReadme = (sourceUrl: string, hasCrawl: boolean): string => [
    '# Generated REST API service',
    '',
    `Serves data scraped from ${sourceUrl || 'the configured site'} out of a small database, via a Flask + SQLAlchemy API — "scrape once (or on a schedule), serve from the DB", not scrape-on-every-request.`,
    '',
    '## Run locally',
    '',
    '```bash',
    'pip install -r requirements.txt',
    'python crawl_db.py   # scrape now, populate data.db',
    'python app.py        # serve on http://localhost:5001',
    '```',
    '',
    '## Run with Docker',
    '',
    '```bash',
    'docker build -t scraper-api .',
    'docker run -p 5001:5001 -v "$(pwd)/data:/app/data" scraper-api',
    '# in another shell, once it\'s up:',
    'docker exec -it <container-id> python crawl_db.py',
    '```',
    '',
    '## Endpoints',
    '',
    '- `GET  /api/sources` — which list functions have data, and how many rows each',
    '- `GET  /api/<source>?page=&per_page=` — paginated rows for one source',
    '- `GET  /api/<source>/<id>` — a single row',
    '- `POST /api/crawl` — re-run the scraper synchronously and replace stored rows (fine for a small site; use crawl_db.py on a schedule for a large one)',
    '',
    '## Keeping data fresh',
    '',
    hasCrawl
        ? 'This service does not re-scrape on its own. Run `python crawl_db.py` on whatever schedule fits — cron, a systemd timer, or a scheduled GitHub Actions workflow (see the project\'s deployment guide) — or call `POST /api/crawl` for a quick one-off refresh on a small site.'
        : 'No pagination function was configured, so crawl_db.py scrapes a single page each run. Run it again whenever you want a fresh snapshot.',
    '',
    '## Notes',
    '',
    '- Default DB is SQLite at `./data.db` (or `/app/data/data.db` in the Docker image) — set `DATABASE_URL` to point at Postgres/MySQL/etc. for production use.',
    '- No authentication on any endpoint — add some before exposing this publicly if the data isn\'t meant to be public.',
    '- `scraper.py` is the same extraction logic as the standalone script generated alongside this service — the picks made in the app are the single source of truth for both.',
    '',
].join('\n')

export interface ApiServiceFiles {
    'scraper.py': string
    'models.py': string
    'app.py': string
    'crawl_db.py': string
    'requirements.txt': string
    'Dockerfile': string
    'README.md': string
}

// Only List functions (optionally paired with Pagination) make sense to
// store — everything else in `functions` is still embedded into scraper.py
// (crawl_db.py's own single-page branch may call it) but doesn't get a table.
export const canGenerateApiService = (functions: FnGroup[]): boolean =>
    functions.some(fn => fn.config.category === 'list')

export const generateApiService = (functions: FnGroup[], sourceUrl: string): ApiServiceFiles => {
    const { code: scraperCode, names } = generateScraperModule(functions, sourceUrl)
    const hasCrawl = functions.some(fn => fn.config.category === 'pagination')
    return {
        'scraper.py': scraperCode,
        'models.py': genModelsPy(),
        'app.py': genAppPy(),
        'crawl_db.py': genCrawlDbPy(functions, names),
        'requirements.txt': genRequirementsTxt(),
        'Dockerfile': genDockerfile(),
        'README.md': genReadme(sourceUrl, hasCrawl),
    }
}
