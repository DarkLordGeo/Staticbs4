import { describe, expect, it } from 'vitest'
import { generatePythonCode } from './codegen'
import type { ElementRef, FnGroup } from '../types/builder'

const ref = (selector: string, tag = 'div'): ElementRef => ({ tag, html: `<${tag}></${tag}>`, selector })

describe('generatePythonCode', () => {
    it('returns a placeholder comment when there are no functions', () => {
        const code = generatePythonCode([], 'https://example.com')
        expect(code).toContain('No functions defined yet')
        expect(code).toContain('URL = "https://example.com"')
    })

    it('generates a header function and a single-page main', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_title', config: { category: 'header', target: ref('h1') } },
        ]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).toContain('def get_title(soup):')
        expect(code).toContain('soup.select_one("h1")')
        expect(code).toContain('if __name__ == "__main__":')
        expect(code).not.toContain('def crawl(')
    })

    it('sanitizes and deduplicates function names', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'Get Title!', config: { category: 'header', target: ref('h1') } },
            { id: '2', name: 'Get Title!', config: { category: 'header', target: ref('h2') } },
        ]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).toContain('def Get_Title_(soup):')
        expect(code).toContain('def Get_Title__2(soup):')
    })

    it('marks an incomplete function (no element picked) without crashing', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_title', config: { category: 'header', target: null } },
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
                fields: [{ id: 'f1', name: 'title', ref: ref('td', 'td') }],
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
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: { category: 'header', target: ref('h1') } }]
        const code = generatePythonCode(functions, 'https://example.com')
        expect(code).not.toContain('import json')
        expect(code).not.toContain('openpyxl')
        expect(code).not.toContain('results.json')
        expect(code).not.toContain('results.xlsx')
    })

    it('writes results.json in single-page mode when json export is enabled', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: { category: 'header', target: ref('h1') } }]
        const code = generatePythonCode(functions, 'https://example.com', { json: true })
        expect(code).toContain('import json')
        expect(code).toContain('results = {')
        expect(code).toContain('"get_title": get_title(soup),')
        expect(code).toContain('json.dump(results, f, indent=2, ensure_ascii=False)')
        expect(code).not.toContain('openpyxl')
    })

    it('writes results.xlsx via openpyxl when xlsx export is enabled, and updates the pip install line', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: { category: 'header', target: ref('h1') } }]
        const code = generatePythonCode(functions, 'https://example.com', { xlsx: true })
        expect(code).toContain('# pip install requests beautifulsoup4 html5lib openpyxl')
        expect(code).toContain('from openpyxl import Workbook')
        expect(code).toContain('workbook.save("results.xlsx")')
        expect(code).not.toContain('import json')
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
