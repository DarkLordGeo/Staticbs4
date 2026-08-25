// Turns a list of configured functions into a standalone, runnable
// BeautifulSoup script — the "get back working BeautifulSoup code" promise
// from the landing page.

import type { ExtractMode, FnConfig, FnGroup } from '../types/builder'

// Which extra output formats to write alongside the printed results — all
// default off so existing generated code (and its tests) is unchanged.
export interface ExportOptions {
    json?: boolean
    xlsx?: boolean
    // Only meaningful when json is also on AND a crawl (list + pagination)
    // is active: groups each list function's JSON output by the page it
    // came from — {"page_1": [...], "page_2": [...]} — instead of merging
    // every page's items into one flat list. Single-page functions in the
    // same script are unaffected (there's only ever one page for those).
    perPageJson?: boolean
    // Two fixes the Review panel can flag and one-click apply — off by
    // default so they don't change existing generated code unasked.
    // politeDelay: only meaningful in crawl mode — sleeps between page
    // requests instead of firing them back-to-back.
    politeDelay?: boolean
    // retryOnFailure: wraps fetch_soup's request in a retry-with-backoff
    // loop instead of letting one flaky request kill the whole run.
    retryOnFailure?: boolean
}

export const pyStr = (s: string): string => JSON.stringify(s)

// A valid, readable Python identifier from a free-text function name.
const pySafeName = (name: string): string => {
    const cleaned = name.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1')
    return cleaned || 'extract'
}

// Resolve duplicate identifiers (e.g. two functions both named "Title!")
// deterministically, in order, rather than letting one silently shadow another.
const uniqueNames = (functions: FnGroup[]): Map<string, string> => {
    const used = new Set<string>()
    const resolved = new Map<string, string>()
    for (const fn of functions) {
        const base = pySafeName(fn.name)
        let candidate = base
        let n = 2
        while (used.has(candidate)) candidate = `${base}_${n++}`
        used.add(candidate)
        resolved.set(fn.id, candidate)
    }
    return resolved
}

const selectorFor = (config: FnConfig): string | null => {
    switch (config.category) {
        case 'header': return config.target?.selector ?? null
        case 'text': return config.target?.selector ?? null
        case 'links': return config.container?.selector ?? null
        case 'list': return config.item?.selector ?? null
        case 'table': return config.table?.selector ?? null
        case 'pagination': return config.mode === 'link' ? (config.next?.selector ?? null) : null
    }
}

const indent = (lines: string[], level = 1): string[] =>
    lines.map(l => (l ? '    '.repeat(level) + l : l))

// A picked element can be read as its text, its inner HTML, or one specific
// attribute (an <img>'s src, a data-* attribute, ...) — shared by the
// single-target categories (header/text) and each list field below, so the
// three extraction shapes are only written once.
const genExtractExpr = (varName: string, extract: ExtractMode): string => {
    switch (extract.kind) {
        case 'text': return `${varName}.get_text(strip=True) if ${varName} else None`
        case 'html': return `${varName}.decode_contents() if ${varName} else None`
        case 'attr': return `${varName}.get(${pyStr(extract.name)}) if ${varName} else None`
    }
}

const genFunction = (name: string, config: FnConfig): string => {
    // Checked before the generic "no selector => incomplete" guard below:
    // url_pattern pagination deliberately has no selector at all (it's not
    // an unfinished pick, it's a different kind of function entirely).
    if (config.category === 'pagination' && config.mode === 'url_pattern') {
        return `# ${name}: URL-pattern pagination has nothing to extract on its own — add a List function to actually crawl pages ${config.startPage}-${config.endPage} of ${pyStr(config.urlTemplate)}.`
    }

    const selector = selectorFor(config)
    if (!selector) {
        return [`def ${name}(soup):`, ...indent(['return None  # incomplete: no element selected'])].join('\n')
    }

    switch (config.category) {
        case 'header':
        case 'text':
            return [
                `def ${name}(soup):`,
                ...indent([
                    `el = soup.select_one(${pyStr(selector)})`,
                    `return ${genExtractExpr('el', config.extract)}`,
                ]),
            ].join('\n')

        case 'links': {
            const body = ['container = soup.select_one(' + pyStr(selector) + ')', 'if not container:', '    return []']
            if (config.extract === 'text') {
                body.push('return [a.get_text(strip=True) for a in container.find_all("a")]')
            } else if (config.extract === 'href') {
                body.push('return [a.get("href") for a in container.find_all("a")]')
            } else {
                body.push(
                    'return [',
                    '    {"text": a.get_text(strip=True), "href": a.get("href")}',
                    '    for a in container.find_all("a")',
                    ']',
                )
            }
            return [`def ${name}(soup):`, ...indent(body)].join('\n')
        }

        case 'list': {
            const body = [`items = soup.select(${pyStr(selector)})`, 'results = []', 'for item in items:']
            if (config.fields.length === 0) {
                body.push('    results.append(item.get_text(strip=True))')
            } else {
                body.push('    entry = {}')
                for (const f of config.fields) {
                    const varName = pySafeName(f.name)
                    if (!f.ref.selector) {
                        body.push(`    entry[${pyStr(f.name)}] = None  # incomplete`)
                        continue
                    }
                    body.push(`    ${varName} = item.select_one(${pyStr(f.ref.selector)})`)
                    body.push(`    entry[${pyStr(f.name)}] = ${genExtractExpr(varName, f.extract)}`)
                }
                body.push('    results.append(entry)')
            }
            body.push('return results')
            return [`def ${name}(soup):`, ...indent(body)].join('\n')
        }

        case 'table': {
            const body = [
                `table = soup.select_one(${pyStr(selector)})`,
                'if not table:',
                '    return []',
                'rows = [',
                '    [cell.get_text(strip=True) for cell in row.find_all(["th", "td"])]',
                '    for row in table.find_all("tr")',
                ']',
            ]
            if (config.firstRowIsHeader) {
                body.push('if not rows:', '    return []', 'header, *body = rows', 'return [dict(zip(header, r)) for r in body]')
            } else {
                body.push('return rows')
            }
            return [`def ${name}(soup):`, ...indent(body)].join('\n')
        }

        case 'pagination':
            // url_pattern mode is handled by the early-return above — only
            // 'link' mode (a real element to select) reaches here.
            return [
                `def ${name}(soup):`,
                ...indent([`el = soup.select_one(${pyStr(selector)})`, `return el.get("href") if el else None`]),
            ].join('\n')
    }
}

const genPreamble = (sourceUrl: string, needsUrljoin: boolean, exportOptions: ExportOptions): string => {
    const pipPackages = ['requests', 'beautifulsoup4', 'html5lib', ...(exportOptions.xlsx ? ['openpyxl'] : [])]
    const needsTime = Boolean(exportOptions.politeDelay || exportOptions.retryOnFailure)
    const parseComment = [
        '    # html5lib (not html.parser) parses the way a browser renders —',
        '    # e.g. it inserts the <tbody> browsers always add to tables, which',
        '    # selectors picked from the live preview rely on.',
        '    #',
        '    # response.content (raw bytes), not response.text: a server that sends',
        '    # Content-Type: text/html with no charset makes requests guess',
        '    # ISO-8859-1 even when the body is actually UTF-8, silently mangling',
        '    # non-ASCII text. Raw bytes let BeautifulSoup detect the real encoding.',
    ]
    const fetchSoupDef = exportOptions.retryOnFailure
        ? [
            'def fetch_soup(url=URL, max_retries=3):',
            '    # Retries with exponential backoff (1s, 2s, 4s, ...) instead of letting',
            '    # one flaky request kill an entire multi-page crawl.',
            '    for attempt in range(max_retries):',
            '        try:',
            '            response = requests.get(url, timeout=10)',
            '            response.raise_for_status()',
            ...parseComment.map(l => '        ' + l),
            '            return BeautifulSoup(response.content, "html5lib")',
            '        except requests.RequestException:',
            '            if attempt == max_retries - 1:',
            '                raise',
            '            time.sleep(2 ** attempt)',
        ]
        : [
            'def fetch_soup(url=URL):',
            '    response = requests.get(url, timeout=10)',
            '    response.raise_for_status()',
            ...parseComment,
            '    return BeautifulSoup(response.content, "html5lib")',
        ]
    return [
        `# pip install ${pipPackages.join(' ')}`,
        'import requests',
        needsTime ? 'import time' : null,
        exportOptions.json ? 'import json' : null,
        needsUrljoin ? 'from urllib.parse import urljoin' : null,
        'from bs4 import BeautifulSoup',
        exportOptions.xlsx ? 'from openpyxl import Workbook' : null,
        '',
        `URL = ${pyStr(sourceUrl.trim() || 'https://example.com')}`,
        '',
        '',
        ...fetchSoupDef,
    ].filter((l): l is string => l !== null).join('\n')
}

// Shared by both single-page and crawl mains: given a dict already in
// scope, optionally write it out as JSON and/or one XLSX sheet per key.
// Indented by the caller to whatever level that dict lives at. JSON and
// XLSX can read from *different* dicts (crawl mode's per-page JSON option
// reads the page-keyed `by_page` dict, while XLSX always reads the flat
// `results` — a spreadsheet doesn't gain anything from per-page sheets).
const genExportEpilogue = (exportOptions: ExportOptions, vars: { json: string; xlsx: string } = { json: 'results', xlsx: 'results' }): string[] => {
    const lines: string[] = []
    if (exportOptions.json) {
        lines.push(
            '',
            'with open("results.json", "w", encoding="utf-8") as f:',
            `    json.dump(${vars.json}, f, indent=2, ensure_ascii=False)`,
            'print("Wrote results.json")',
        )
    }
    if (exportOptions.xlsx) {
        lines.push(
            '',
            'workbook = Workbook()',
            'workbook.remove(workbook.active)',
            `for name, value in ${vars.xlsx}.items():`,
            '    sheet = workbook.create_sheet(title=name[:31])  # Excel sheet names cap at 31 chars',
            '    if isinstance(value, list) and value and isinstance(value[0], dict):',
            '        headers = list(value[0].keys())',
            '        sheet.append(headers)',
            '        for row in value:',
            '            sheet.append([row.get(h) for h in headers])',
            '    elif isinstance(value, list):',
            '        sheet.append(["value"])',
            '        for row in value:',
            '            sheet.append([row])',
            '    else:',
            '        sheet.append(["value"])',
            '        sheet.append([value])',
            'workbook.save("results.xlsx")',
            'print("Wrote results.xlsx")',
        )
    }
    return lines
}

const genSimpleMain = (functions: FnGroup[], names: Map<string, string>, exportOptions: ExportOptions): string => {
    // A standalone (no List paired) url_pattern pagination function has no
    // def to call — genFunction emitted a comment for it instead of a def.
    const printable = functions.filter(fn => !(fn.config.category === 'pagination' && fn.config.mode === 'url_pattern'))
    return [
        'if __name__ == "__main__":',
        '    soup = fetch_soup()',
        '    results = {',
        ...indent(printable.map(fn => `${pyStr(names.get(fn.id)!)}: ${names.get(fn.id)}(soup),`), 2),
        '    }',
        '    for name, value in results.items():',
        '        print(f"{name}:", value)',
        ...indent(genExportEpilogue(exportOptions)),
    ].join('\n')
}

// When a 'list' function is paired with a 'pagination' function, generate an
// actual multi-page crawl instead of just extracting from one page — run
// every list function on each page visited and accumulate. Any other
// (non-list, non-pagination) functions still only make sense against a
// single page, so they're left running once against the first one.
const genCrawlMain = (
    functions: FnGroup[], names: Map<string, string>, paginationFn: FnGroup, listFns: FnGroup[], exportOptions: ExportOptions,
): string => {
    const config = paginationFn.config
    if (config.category !== 'pagination') throw new Error('unreachable') // narrows the type below
    const otherFns = functions.filter(fn => fn.config.category !== 'list' && fn.id !== paginationFn.id)

    const listFunctionsBlock = [
        'LIST_FUNCTIONS = {',
        ...listFns.map(fn => `    ${pyStr(names.get(fn.id)!)}: ${names.get(fn.id)},`),
        '}',
    ].join('\n')

    // Grouping JSON by page needs the page each item came from tracked
    // *during* the crawl — results is already merged flat by the time
    // crawl() returns, and there's no way to un-merge it afterward.
    const perPage = Boolean(exportOptions.json && exportOptions.perPageJson)
    const politeDelay = Boolean(exportOptions.politeDelay)

    const crawlDef = config.mode === 'url_pattern'
        ? [
            `URL_TEMPLATE = ${pyStr(config.urlTemplate)}`,
            `START_PAGE = ${config.startPage}`,
            `END_PAGE = ${config.endPage}`,
            politeDelay ? 'REQUEST_DELAY = 1  # seconds between page requests' : null,
            '',
            '',
            'def crawl():',
            '    """Step through URL_TEMPLATE from START_PAGE to END_PAGE (inclusive),',
            '    running every list function on each page and accumulating results."""',
            '    results = {name: [] for name in LIST_FUNCTIONS}',
            ...(perPage ? ['    by_page = {name: {} for name in LIST_FUNCTIONS}'] : []),
            '    for page in range(START_PAGE, END_PAGE + 1):',
            '        url = URL_TEMPLATE.format(page=page)',
            '        soup = fetch_soup(url)',
            '        for name, fn in LIST_FUNCTIONS.items():',
            ...(perPage
                ? [
                    '            items = fn(soup)',
                    '            results[name].extend(items)',
                    '            by_page[name][f"page_{page}"] = items',
                ]
                : ['            results[name].extend(fn(soup))']),
            politeDelay ? '        time.sleep(REQUEST_DELAY)' : null,
            perPage ? '    return results, by_page' : '    return results',
        ].filter((l): l is string => l !== null).join('\n')
        : [
            'MAX_PAGES = 20',
            politeDelay ? 'REQUEST_DELAY = 1  # seconds between page requests' : null,
            '',
            '',
            'def crawl(start_url=URL, max_pages=MAX_PAGES):',
            '    """Follow the picked "next page" link, running every list function',
            '    on each page visited and accumulating results."""',
            '    url = start_url',
            '    pages = 0',
            '    results = {name: [] for name in LIST_FUNCTIONS}',
            ...(perPage ? ['    by_page = {name: {} for name in LIST_FUNCTIONS}'] : []),
            '    while url and pages < max_pages:',
            '        soup = fetch_soup(url)',
            '        for name, fn in LIST_FUNCTIONS.items():',
            ...(perPage
                ? [
                    '            items = fn(soup)',
                    '            results[name].extend(items)',
                    '            by_page[name][f"page_{pages + 1}"] = items',
                ]
                : ['            results[name].extend(fn(soup))']),
            `        next_href = ${names.get(paginationFn.id)!}(soup)`,
            '        url = urljoin(url, next_href) if next_href else None',
            '        pages += 1',
            politeDelay ? '        time.sleep(REQUEST_DELAY)' : null,
            perPage ? '    return results, by_page' : '    return results',
        ].filter((l): l is string => l !== null).join('\n')

    const main = [
        'if __name__ == "__main__":',
        perPage ? '    results, by_page = crawl()' : '    results = crawl()',
        ...(otherFns.length > 0
            ? [
                '',
                '    soup = fetch_soup()  # single-page functions below run once, against the first page',
                ...otherFns.flatMap(fn => {
                    const key = pyStr(names.get(fn.id)!)
                    if (!perPage) return [`    results[${key}] = ${names.get(fn.id)}(soup)`]
                    // Not paginated, so nothing to group by page — but still
                    // needs to show up in by_page, since that's what gets
                    // written to results.json in this mode.
                    return [
                        `    ${names.get(fn.id)}_value = ${names.get(fn.id)}(soup)`,
                        `    results[${key}] = ${names.get(fn.id)}_value`,
                        `    by_page[${key}] = ${names.get(fn.id)}_value`,
                    ]
                }),
                '',
            ]
            : []),
        '    for name, value in results.items():',
        '        if isinstance(value, list):',
        '            print(f"{name}: {len(value)} items")',
        '        else:',
        '            print(f"{name}:", value)',
        ...indent(genExportEpilogue(exportOptions, { json: perPage ? 'by_page' : 'results', xlsx: 'results' })),
    ].join('\n')

    return [listFunctionsBlock, crawlDef, main].join('\n\n\n')
}

// Just the imports/fetch_soup/def blocks, no __main__ — the reusable core
// that both the standalone script (below) and the generated REST API
// service's scraper.py embed, so extraction logic is never duplicated.
export const generateScraperModule = (functions: FnGroup[], sourceUrl: string): { code: string; names: Map<string, string> } => {
    const names = uniqueNames(functions)
    const preamble = genPreamble(sourceUrl, false, {})
    if (functions.length === 0) return { code: preamble + '\n', names }

    const body = functions.map(fn => genFunction(names.get(fn.id)!, fn.config)).join('\n\n\n')
    return { code: [preamble, body].join('\n\n\n') + '\n', names }
}

export const generatePythonCode = (functions: FnGroup[], sourceUrl: string, exportOptions: ExportOptions = {}): string => {
    const names = uniqueNames(functions)

    if (functions.length === 0) {
        return genPreamble(sourceUrl, false, {}) + '\n\n\n# No functions defined yet — pick some elements to generate extraction code.\n'
    }

    const paginationFn = functions.find(fn => fn.config.category === 'pagination')
    const listFns = functions.filter(fn => fn.config.category === 'list')
    const crawlMode = paginationFn !== undefined && listFns.length > 0
    const isUrlPatternMode = paginationFn?.config.category === 'pagination' && paginationFn.config.mode === 'url_pattern'
    // url_pattern mode uses str.format(), not urljoin — only 'link' mode
    // resolves a possibly-relative href against the current page's URL.
    const needsUrljoin = crawlMode && !isUrlPatternMode
    // politeDelay only ever inserts a time.sleep() inside a crawl loop — outside
    // crawl mode there's nothing to insert it into, so drop it here rather than
    // importing `time` for nothing in the single-page case.
    const effectiveOptions: ExportOptions = { ...exportOptions, politeDelay: crawlMode && exportOptions.politeDelay }

    const preamble = genPreamble(sourceUrl, needsUrljoin, effectiveOptions)
    // In crawl mode, a url_pattern pagination function has no def of its own
    // (see genFunction) — its template/range go straight into crawl().
    const bodyFns = crawlMode && isUrlPatternMode
        ? functions.filter(fn => fn.id !== paginationFn.id)
        : functions
    const body = bodyFns.map(fn => genFunction(names.get(fn.id)!, fn.config)).join('\n\n\n')
    const main = crawlMode
        ? genCrawlMain(functions, names, paginationFn, listFns, effectiveOptions)
        : genSimpleMain(functions, names, effectiveOptions)

    return [preamble, body, main].join('\n\n\n') + '\n'
}
