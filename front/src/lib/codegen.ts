// Turns a list of configured functions into a standalone, runnable
// BeautifulSoup script — the "get back working BeautifulSoup code" promise
// from the landing page.

import type { FnConfig, FnGroup } from '../types/builder'

const pyStr = (s: string): string => JSON.stringify(s)

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
        case 'pagination': return config.next?.selector ?? null
    }
}

const indent = (lines: string[], level = 1): string[] =>
    lines.map(l => (l ? '    '.repeat(level) + l : l))

const genFunction = (name: string, config: FnConfig): string => {
    const selector = selectorFor(config)
    if (!selector) {
        return [`def ${name}(soup):`, ...indent(['return None  # incomplete: no element selected'])].join('\n')
    }

    switch (config.category) {
        case 'header':
            return [
                `def ${name}(soup):`,
                ...indent([
                    `el = soup.select_one(${pyStr(selector)})`,
                    `return el.get_text(strip=True) if el else None`,
                ]),
            ].join('\n')

        case 'text':
            return [
                `def ${name}(soup):`,
                ...indent([
                    `el = soup.select_one(${pyStr(selector)})`,
                    config.mode === 'html'
                        ? `return el.decode_contents() if el else None`
                        : `return el.get_text(strip=True) if el else None`,
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
                    body.push(`    entry[${pyStr(f.name)}] = ${varName}.get_text(strip=True) if ${varName} else None`)
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
            return [
                `def ${name}(soup):`,
                ...indent([`el = soup.select_one(${pyStr(selector)})`, `return el.get("href") if el else None`]),
            ].join('\n')
    }
}

const genPreamble = (sourceUrl: string, needsUrljoin: boolean): string => [
    '# pip install requests beautifulsoup4 html5lib',
    'import requests',
    needsUrljoin ? 'from urllib.parse import urljoin' : null,
    'from bs4 import BeautifulSoup',
    '',
    `URL = ${pyStr(sourceUrl.trim() || 'https://example.com')}`,
    '',
    '',
    'def fetch_soup(url=URL):',
    '    response = requests.get(url, timeout=10)',
    '    response.raise_for_status()',
    '    # html5lib (not html.parser) parses the way a browser renders —',
    '    # e.g. it inserts the <tbody> browsers always add to tables, which',
    '    # selectors picked from the live preview rely on.',
    '    return BeautifulSoup(response.text, "html5lib")',
].filter((l): l is string => l !== null).join('\n')

const genSimpleMain = (functions: FnGroup[], names: Map<string, string>): string => [
    'if __name__ == "__main__":',
    '    soup = fetch_soup()',
    ...functions.map(fn => `    print(${pyStr(names.get(fn.id)! + ':')}, ${names.get(fn.id)}(soup))`),
].join('\n')

// When a 'list' function is paired with a 'pagination' function, generate an
// actual multi-page crawl instead of just returning the next link's href
// once — follow it, re-run every list function on each page, and accumulate.
// Any other (non-list, non-pagination) functions still only make sense
// against a single page, so they're left running once against the first one.
const genCrawlMain = (functions: FnGroup[], names: Map<string, string>, paginationFn: FnGroup, listFns: FnGroup[]): string => {
    const paginationName = names.get(paginationFn.id)!
    const otherFns = functions.filter(fn => fn.config.category !== 'list' && fn.id !== paginationFn.id)

    const crawl = [
        'MAX_PAGES = 20',
        '',
        'LIST_FUNCTIONS = {',
        ...listFns.map(fn => `    ${pyStr(names.get(fn.id)!)}: ${names.get(fn.id)},`),
        '}',
        '',
        '',
        'def crawl(start_url=URL, max_pages=MAX_PAGES):',
        '    """Follow the picked "next page" link, running every list function',
        '    on each page visited and accumulating their results."""',
        '    url = start_url',
        '    pages = 0',
        '    results = {name: [] for name in LIST_FUNCTIONS}',
        '    while url and pages < max_pages:',
        '        soup = fetch_soup(url)',
        '        for name, fn in LIST_FUNCTIONS.items():',
        '            results[name].extend(fn(soup))',
        `        next_href = ${paginationName}(soup)`,
        '        url = urljoin(url, next_href) if next_href else None',
        '        pages += 1',
        '    return results',
    ].join('\n')

    const main = [
        'if __name__ == "__main__":',
        '    data = crawl()',
        '    for name, items in data.items():',
        '        print(f"{name}: {len(items)} items")',
        ...(otherFns.length > 0
            ? [
                '',
                '    soup = fetch_soup()  # single-page functions below run once, against the first page',
                ...otherFns.map(fn => `    print(${pyStr(names.get(fn.id)! + ':')}, ${names.get(fn.id)}(soup))`),
            ]
            : []),
    ].join('\n')

    return [crawl, main].join('\n\n\n')
}

export const generatePythonCode = (functions: FnGroup[], sourceUrl: string): string => {
    const names = uniqueNames(functions)

    if (functions.length === 0) {
        return genPreamble(sourceUrl, false) + '\n\n\n# No functions defined yet — pick some elements to generate extraction code.\n'
    }

    const paginationFn = functions.find(fn => fn.config.category === 'pagination')
    const listFns = functions.filter(fn => fn.config.category === 'list')
    const crawlMode = paginationFn !== undefined && listFns.length > 0

    const preamble = genPreamble(sourceUrl, crawlMode)
    const body = functions.map(fn => genFunction(names.get(fn.id)!, fn.config)).join('\n\n\n')
    const main = crawlMode
        ? genCrawlMain(functions, names, paginationFn, listFns)
        : genSimpleMain(functions, names)

    return [preamble, body, main].join('\n\n\n') + '\n'
}
