// Client-side mirror of codegen.ts's extraction logic, run directly against
// the live preview iframe's DOM. Lets you see real extracted values before
// ever leaving the app — the browser's DOM already reflects the same HTML5
// parsing (implicit <tbody>, etc.) the generated Python's html5lib backend
// reproduces, so what you see here should closely match what the script
// returns when it actually runs.

import type { FnConfig, FnGroup } from '../types/builder'

export type ExtractionResult =
    | { ok: true; value: unknown }
    | { ok: false; error: string }

const textOf = (el: Element): string => (el.textContent ?? '').trim()

const extractOne = (doc: Document, config: FnConfig): unknown => {
    switch (config.category) {
        case 'header':
        case 'text': {
            if (!config.target) throw new Error('no target element selected')
            const el = doc.querySelector(config.target.selector)
            if (!el) return null
            if (config.category === 'text' && config.mode === 'html') return el.innerHTML
            return textOf(el)
        }

        case 'links': {
            if (!config.container) throw new Error('no container element selected')
            const container = doc.querySelector(config.container.selector)
            if (!container) return []
            return Array.from(container.querySelectorAll('a')).map(a => {
                const text = textOf(a)
                const href = a.getAttribute('href')
                if (config.extract === 'text') return text
                if (config.extract === 'href') return href
                return { text, href }
            })
        }

        case 'list': {
            if (!config.item) throw new Error('no item element selected')
            const items = Array.from(doc.querySelectorAll(config.item.selector))
            if (config.fields.length === 0) return items.map(textOf)
            return items.map(item => {
                const entry: Record<string, string | null> = {}
                for (const f of config.fields) {
                    if (!f.ref.selector) { entry[f.name] = null; continue }
                    const fieldEl = item.querySelector(f.ref.selector)
                    entry[f.name] = fieldEl ? textOf(fieldEl) : null
                }
                return entry
            })
        }

        case 'table': {
            if (!config.table) throw new Error('no table element selected')
            const table = doc.querySelector(config.table.selector)
            if (!table) return []
            const rows = Array.from(table.querySelectorAll('tr')).map(row =>
                Array.from(row.querySelectorAll('th, td')).map(textOf)
            )
            if (!config.firstRowIsHeader) return rows
            if (rows.length === 0) return []
            const [header, ...body] = rows
            return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])))
        }

        case 'pagination': {
            if (!config.next) throw new Error('no next-page element selected')
            const el = doc.querySelector(config.next.selector)
            return el ? el.getAttribute('href') : null
        }
    }
}

export const runExtraction = (doc: Document, functions: FnGroup[]): Record<string, ExtractionResult> => {
    const results: Record<string, ExtractionResult> = {}
    for (const fn of functions) {
        try {
            results[fn.name] = { ok: true, value: extractOne(doc, fn.config) }
        } catch (e) {
            results[fn.name] = { ok: false, error: e instanceof Error ? e.message : String(e) }
        }
    }
    return results
}
