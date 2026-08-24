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

export const generatePythonCode = (functions: FnGroup[], sourceUrl: string): string => {
    const names = uniqueNames(functions)

    const preamble = [
        '# pip install requests beautifulsoup4 html5lib',
        'import requests',
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
    ].join('\n')

    if (functions.length === 0) {
        return preamble + '\n\n\n# No functions defined yet — pick some elements to generate extraction code.\n'
    }

    const body = functions.map(fn => genFunction(names.get(fn.id)!, fn.config)).join('\n\n\n')

    const main = [
        'if __name__ == "__main__":',
        '    soup = fetch_soup()',
        ...functions.map(fn => `    print(${pyStr(names.get(fn.id)! + ':')}, ${names.get(fn.id)}(soup))`),
    ].join('\n')

    return [preamble, body, main].join('\n\n\n') + '\n'
}
