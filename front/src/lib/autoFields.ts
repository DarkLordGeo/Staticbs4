// Suggests sub-fields for a picked list "item" instead of making you
// manually pick each one — the pain point for a wide table (one manual pick
// per column) or a content-heavy card.

import { relativeSelector } from './selector'

export type FieldCandidate = {
    tag: string
    selector: string   // relative to the item element
    suggestedName: string
    preview: string
}

const truncate = (s: string, max = 40): string => (s.length > max ? s.slice(0, max) + '…' : s)
const cleanText = (el: Element): string => (el.textContent ?? '').trim()

// A reasonably readable default name: first "normal" class token, else the tag.
const suggestName = (el: Element, index: number): string => {
    const cls = Array.from(el.classList).find(c => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c))
    const base = (cls ?? el.tagName.toLowerCase()).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    return base || `field_${index}`
}

const dedupeNames = (names: string[]): string[] => {
    const seen = new Map<string, number>()
    return names.map(name => {
        const count = seen.get(name) ?? 0
        seen.set(name, count + 1)
        return count === 0 ? name : `${name}_${count + 1}`
    })
}

const MAX_RAW = 50        // guard against pathologically deep/wide subtrees
const MAX_CANDIDATES = 15  // keep the checklist usable

// True leaf elements (no element children) with their own text — descends
// past wrapper elements rather than treating them as one big candidate, so
// e.g. <td><a>100</a></td> yields the <a> (still the right text either way).
const collectLeaves = (root: Element): Element[] => {
    const out: Element[] = []
    const walk = (el: Element) => {
        for (const child of Array.from(el.children)) {
            if (out.length >= MAX_RAW) return
            if (child.children.length === 0) {
                if (cleanText(child).length > 0) out.push(child)
            } else {
                walk(child)
            }
        }
    }
    walk(root)
    return out
}

export const detectFields = (item: Element): FieldCandidate[] => {
    // Table rows: one candidate per cell, in column order — cells almost
    // never carry a distinguishing class, so this is the case a generic
    // leaf-walk would otherwise struggle to name well.
    const raw = item.tagName === 'TR'
        ? Array.from(item.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH')
        : collectLeaves(item)

    const trimmed = raw.slice(0, MAX_CANDIDATES)
    const names = dedupeNames(trimmed.map((c, i) => suggestName(c, i + 1)))
    return trimmed.map((el, i) => ({
        tag: el.tagName.toLowerCase(),
        selector: relativeSelector(el, item),
        suggestedName: names[i],
        preview: truncate(cleanText(el)) || '(empty)',
    }))
}
