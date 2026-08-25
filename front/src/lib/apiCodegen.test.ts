import { describe, expect, it } from 'vitest'
import { canGenerateApiService, generateApiService } from './apiCodegen'
import type { ElementRef, FnGroup } from '../types/builder'

const ref = (selector: string, tag = 'div'): ElementRef => ({ tag, html: `<${tag}></${tag}>`, selector })

describe('canGenerateApiService', () => {
    it('requires at least one List function', () => {
        expect(canGenerateApiService([])).toBe(false)
        expect(canGenerateApiService([
            { id: '1', name: 'get_title', config: { category: 'header', target: ref('h1'), extract: { kind: 'text' } } },
        ])).toBe(false)
        expect(canGenerateApiService([
            { id: '1', name: 'get_items', config: { category: 'list', item: ref('li'), fields: [] } },
        ])).toBe(true)
    })
})

describe('generateApiService', () => {
    const listFn: FnGroup = { id: '1', name: 'get_items', config: { category: 'list', item: ref('li'), fields: [] } }

    it('generates all seven files for a single-page (no pagination) service', () => {
        const files = generateApiService([listFn], 'https://example.com')
        expect(Object.keys(files).sort()).toEqual(
            ['Dockerfile', 'README.md', 'app.py', 'crawl_db.py', 'models.py', 'requirements.txt', 'scraper.py'].sort()
        )
        expect(files['scraper.py']).toContain('def get_items(soup):')
        expect(files['crawl_db.py']).toContain('def crawl():')
        expect(files['crawl_db.py']).toContain('return {name: fn(soup) for name, fn in LIST_FUNCTIONS.items()}')
        expect(files['crawl_db.py']).not.toContain('urljoin')
    })

    it('embeds a url_pattern crawl loop in crawl_db.py, matching the standalone script\'s shape', () => {
        const paginate: FnGroup = {
            id: '2', name: 'paginate',
            config: { category: 'pagination', mode: 'url_pattern', urlTemplate: 'https://example.com/page-{page}.html', startPage: 1, endPage: 5 },
        }
        const files = generateApiService([listFn, paginate], 'https://example.com')
        expect(files['crawl_db.py']).toContain('URL_TEMPLATE = "https://example.com/page-{page}.html"')
        expect(files['crawl_db.py']).toContain('for page in range(START_PAGE, END_PAGE + 1):')
        expect(files['crawl_db.py']).not.toContain('urljoin')
        // url_pattern pagination has no def of its own in scraper.py either
        expect(files['scraper.py']).not.toContain('def paginate(')
    })

    it('embeds a link-follow crawl loop and imports urljoin when pagination is link mode', () => {
        const paginate: FnGroup = {
            id: '2', name: 'paginate',
            config: { category: 'pagination', mode: 'link', next: ref('#next', 'a') },
        }
        const files = generateApiService([listFn, paginate], 'https://example.com')
        expect(files['crawl_db.py']).toContain('from urllib.parse import urljoin')
        expect(files['crawl_db.py']).toContain('while url and pages < max_pages:')
        expect(files['crawl_db.py']).toContain('next_href = paginate(soup)')
        expect(files['scraper.py']).toContain('def paginate(soup):')
    })

    it('replaces rather than accumulates on re-crawl, and reuses the app for db access', () => {
        const files = generateApiService([listFn], 'https://example.com')
        expect(files['crawl_db.py']).toContain('Record.query.filter_by(source=source).delete()')
        expect(files['crawl_db.py']).toContain('def run_crawl(app=None):')
        expect(files['crawl_db.py']).toContain('app = app or create_app()')
    })

    it('models.py defines a single generic table, not one per function', () => {
        const files = generateApiService([listFn], 'https://example.com')
        expect(files['models.py']).toContain('class Record(db.Model):')
        expect(files['models.py']).toContain('__tablename__ = "records"')
        expect(files['models.py']).toContain('source = db.Column')
        expect(files['models.py']).toContain('data = db.Column(db.JSON')
    })

    it('app.py exposes sources/list/detail/crawl endpoints and defaults to sqlite', () => {
        const files = generateApiService([listFn], 'https://example.com')
        expect(files['app.py']).toContain('@app.get("/api/sources")')
        expect(files['app.py']).toContain('@app.get("/api/<source>")')
        expect(files['app.py']).toContain('@app.get("/api/<source>/<int:record_id>")')
        expect(files['app.py']).toContain('@app.post("/api/crawl")')
        expect(files['app.py']).toContain('sqlite:///data.db')
    })

    it('requirements.txt and Dockerfile are self-contained for a standalone deploy', () => {
        const files = generateApiService([listFn], 'https://example.com')
        expect(files['requirements.txt']).toContain('flask')
        expect(files['requirements.txt']).toContain('flask-sqlalchemy')
        expect(files['Dockerfile']).toContain('FROM python:3.12-slim')
        expect(files['Dockerfile']).toContain('EXPOSE 5001')
    })
})
