import { describe, expect, it } from 'vitest'
import { generatePythonCode } from './codegen'
import type { ElementRef, FnConfig, FnGroup, ListField } from '../types/builder'

const ref = (selector: string, tag = 'div'): ElementRef => ({ tag, html: `<${tag}></${tag}>`, selector })
const header = (target: ElementRef | null): FnConfig => ({ category: 'header', target, extract: { kind: 'text' } })
const field = (name: string, fieldRef: ElementRef): ListField => ({ id: name, name, ref: fieldRef, extract: { kind: 'text' } })

describe('generatePythonCode', () => {
    it('returns a placeholder comment when there are no functions', () => {
        const code = generatePythonCode([], 'https://example.com')
        expect(code).toContain('No functions defined yet')
        expect(code).toContain('URL = "https://example.com"')
    })

    it('generates a header function and a single-page main', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_title', config: header(ref('h1')) },
        ]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).toContain('def get_title(soup):')
        expect(code).toContain('soup.select_one("h1")')
        expect(code).toContain('if __name__ == "__main__":')
        expect(code).not.toContain('def crawl(')
    })

    it('sanitizes and deduplicates function names', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'Get Title!', config: header(ref('h1')) },
            { id: '2', name: 'Get Title!', config: header(ref('h2')) },
        ]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).toContain('def Get_Title_(soup):')
        expect(code).toContain('def Get_Title__2(soup):')
    })

    it('marks an incomplete function (no element picked) without crashing', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_title', config: header(null) },
        ]
        expect(generatePythonCode(functions, 'https://example.com')).toContain('incomplete')
    })

    it('generates a list function with nested field selectors', () => {
        const functions: FnGroup[] = [{
            id: '1',
            name: 'get_jobs',
            config: {
                category: 'list',
                item: ref('tr'),
                fields: [field('title', ref('td', 'td'))],
            },
        }]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).toContain('items = soup.select("tr")')
        expect(code).toContain('item.select_one("td")')
        expect(code).toContain('entry["title"]')
    })

    it('generates a crawl loop when list + pagination are both present', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_jobs', config: { category: 'list', item: ref('tr'), fields: [] } },
            { id: '2', name: 'get_next', config: { category: 'pagination', mode: 'link', next: ref('#next', 'a') } },
        ]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).toContain('def crawl(')
        expect(code).toContain('from urllib.parse import urljoin')
        expect(code).toContain('"get_jobs": get_jobs')
        // pagination isn't printed standalone once it's consumed by crawl()
        expect(code).not.toContain('print("get_next:"')
    })

    it('does not enter crawl mode with a pagination function but no list function', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_next', config: { category: 'pagination', mode: 'link', next: ref('#next', 'a') } },
        ]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).not.toContain('def crawl(')
        expect(code).toContain('"get_next": get_next(soup),')
    })

    it('falls back to a placeholder URL when none was provided', () => {
        const code = generatePythonCode([], '   ')
        expect(code).toContain('URL = "https://example.com"')
    })

    it('generates a range-based crawl for url_pattern pagination', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_jobs', config: { category: 'list', item: ref('tr'), fields: [] } },
            {
                id: '2', name: 'paginate',
                config: { category: 'pagination', mode: 'url_pattern', urlTemplate: 'https://example.com/page-{page}.html', startPage: 1, endPage: 5 },
            },
        ]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).toContain('def crawl(')
        expect(code).toContain('URL_TEMPLATE = "https://example.com/page-{page}.html"')
        expect(code).toContain('START_PAGE = 1')
        expect(code).toContain('END_PAGE = 5')
        expect(code).toContain('URL_TEMPLATE.format(page=page)')
        // url_pattern mode has no def of its own and doesn't need urljoin
        expect(code).not.toContain('def paginate(')
        expect(code).not.toContain('urljoin')
    })

    it('marks a standalone url_pattern pagination function as needing a List pair', () => {
        const functions: FnGroup[] = [
            {
                id: '1', name: 'paginate',
                config: { category: 'pagination', mode: 'url_pattern', urlTemplate: 'https://example.com/page-{page}.html', startPage: 1, endPage: 5 },
            },
        ]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).not.toContain('def crawl(')
        expect(code).not.toContain('def paginate(')
        expect(code).toContain('add a List function')
    })

    it('adds no JSON/XLSX code when export options are omitted', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: header(ref('h1')) }]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).not.toContain('import json')
        expect(code).not.toContain('openpyxl')
        expect(code).not.toContain('results.json')
        expect(code).not.toContain('results.xlsx')
    })

    it('writes results.json in single-page mode when json export is enabled', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: header(ref('h1')) }]
        const code = generatePythonCode(functions, 'https://example.com', { json: true })
        expect(code).toContain('import json')
        expect(code).toContain('results = {')
        expect(code).toContain('"get_title": get_title(soup),')
        expect(code).toContain('json.dump(results, f, indent=2, ensure_ascii=False)')
        expect(code).not.toContain('openpyxl')
    })

    it('writes results.xlsx via openpyxl when xlsx export is enabled, and updates the pip install line', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: header(ref('h1')) }]
        const code = generatePythonCode(functions, 'https://example.com', { xlsx: true })
        expect(code).toContain('# pip install requests beautifulsoup4 html5lib openpyxl')
        expect(code).toContain('from openpyxl import Workbook')
        expect(code).toContain('workbook.save("results.xlsx")')
        expect(code).not.toContain('import json')
    })

    it('generates attribute extraction for a header target and a list field — e.g. img src, a href', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_logo', config: { category: 'header', target: ref('img.logo', 'img'), extract: { kind: 'attr', name: 'src' } } },
            {
                id: '2', name: 'get_items', config: {
                    category: 'list',
                    item: ref('li'),
                    fields: [
                        { id: 'f1', name: 'href', ref: ref('a', 'a'), extract: { kind: 'attr', name: 'href' } },
                        { id: 'f2', name: 'raw', ref: ref('div.raw', 'div'), extract: { kind: 'html' } },
                    ],
                },
            },
        ]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).toContain('el.get("src") if el else None')
        expect(code).toContain('entry["href"] = href.get("href") if href else None')
        expect(code).toContain('entry["raw"] = raw.decode_contents() if raw else None')
    })

    it('groups JSON by page when perPageJson is enabled in crawl mode', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_jobs', config: { category: 'list', item: ref('tr'), fields: [] } },
            {
                id: '2', name: 'paginate',
                config: { category: 'pagination', mode: 'url_pattern', urlTemplate: 'https://example.com/page-{page}.html', startPage: 1, endPage: 3 },
            },
        ]
        const code = generatePythonCode(functions, 'https://example.com', { json: true, perPageJson: true })
        expect(code).toContain('results, by_page = crawl()')
        expect(code).toContain('by_page = {name: {} for name in LIST_FUNCTIONS}')
        expect(code).toContain('by_page[name][f"page_{page}"] = items')
        expect(code).toContain('json.dump(by_page, f, indent=2, ensure_ascii=False)')
        expect(code).toContain('return results, by_page')
    })

    it('groups by visit count in link-mode crawl, and still merges non-paginated functions into by_page', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_jobs', config: { category: 'list', item: ref('tr'), fields: [] } },
            { id: '2', name: 'get_next', config: { category: 'pagination', mode: 'link', next: ref('#next', 'a') } },
            { id: '3', name: 'get_title', config: header(ref('h1')) },
        ]
        const code = generatePythonCode(functions, 'https://example.com', { json: true, perPageJson: true })
        expect(code).toContain('by_page[name][f"page_{pages + 1}"] = items')
        expect(code).toContain('by_page["get_title"] = get_title_value')
    })

    it('ignores perPageJson outside crawl mode (falls back to flat JSON)', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: header(ref('h1')) }]
        const code = generatePythonCode(functions, 'https://example.com', { json: true, perPageJson: true })
        expect(code).not.toContain('by_page')
        expect(code).toContain('json.dump(results, f, indent=2, ensure_ascii=False)')
    })

    it('ignores perPageJson when json export itself is off', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_jobs', config: { category: 'list', item: ref('tr'), fields: [] } },
            { id: '2', name: 'get_next', config: { category: 'pagination', mode: 'link', next: ref('#next', 'a') } },
        ]
        const code = generatePythonCode(functions, 'https://example.com', { perPageJson: true })
        expect(code).not.toContain('by_page')
        expect(code).toContain('results = crawl()')
    })

    it('wraps fetch_soup in a retry loop when retryOnFailure is enabled', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: header(ref('h1')) }]
        const code = generatePythonCode(functions, 'https://example.com', { retryOnFailure: true })
        expect(code).toContain('import time')
        expect(code).toContain('def fetch_soup(url=URL, max_retries=3):')
        expect(code).toContain('for attempt in range(max_retries):')
        expect(code).toContain('except requests.RequestException:')
        expect(code).toContain('time.sleep(2 ** attempt)')
    })

    it('does not touch fetch_soup when retryOnFailure is off', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: header(ref('h1')) }]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).toContain('def fetch_soup(url=URL):')
        expect(code).not.toContain('import time')
        expect(code).not.toContain('max_retries')
    })

    it('adds a delay between page requests in a crawl loop when politeDelay is enabled', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_jobs', config: { category: 'list', item: ref('tr'), fields: [] } },
            {
                id: '2', name: 'paginate',
                config: { category: 'pagination', mode: 'url_pattern', urlTemplate: 'https://example.com/page-{page}.html', startPage: 1, endPage: 5 },
            },
        ]
        const code = generatePythonCode(functions, 'https://example.com', { politeDelay: true })
        expect(code).toContain('import time')
        expect(code).toContain('REQUEST_DELAY = 1')
        expect(code).toContain('time.sleep(REQUEST_DELAY)')
    })

    it('ignores politeDelay outside crawl mode (nothing to insert it into)', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: header(ref('h1')) }]
        const code = generatePythonCode(functions, 'https://example.com', { politeDelay: true })
        expect(code).not.toContain('import time')
        expect(code).not.toContain('REQUEST_DELAY')
    })

    it('adds a delay in the link-follow crawl loop too, when politeDelay is enabled', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_jobs', config: { category: 'list', item: ref('tr'), fields: [] } },
            { id: '2', name: 'get_next', config: { category: 'pagination', mode: 'link', next: ref('#next', 'a') } },
        ]
        const code = generatePythonCode(functions, 'https://example.com', { politeDelay: true })
        expect(code).toContain('time.sleep(REQUEST_DELAY)')
        expect(code).toContain('from urllib.parse import urljoin')
    })

    it('supports both export formats together in crawl mode, keyed by the results dict', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_jobs', config: { category: 'list', item: ref('tr'), fields: [] } },
            { id: '2', name: 'get_next', config: { category: 'pagination', mode: 'link', next: ref('#next', 'a') } },
        ]
        const code = generatePythonCode(functions, 'https://example.com', { json: true, xlsx: true })
        expect(code).toContain('results = crawl()')
        expect(code).toContain('json.dump(results, f, indent=2, ensure_ascii=False)')
        expect(code).toContain('workbook.save("results.xlsx")')
    })
})
