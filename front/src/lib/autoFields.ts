// Suggests sub-fields for a picked list "item" instead of making you
// manually pick each one — the pain point for a wide table (one manual pick
// per column) or a content-heavy card.

import { relativeSelector } from './selector'
import { defaultExtractModeFor } from './elementLayers'
import type { ExtractMode } from '../types/builder'

export type FieldCandidate = {
    tag: string
    selector: string   // relative to the item element
    suggestedName: string
    preview: string
    extract: ExtractMode
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

// Attributes worth treating as "content" on an otherwise textless element —
// an <img> has no text at all, but its src is exactly the field wanted.
const FALLBACK_ATTRS = ['src', 'href', 'alt', 'title', 'value', 'content']
const hasExtractableContent = (el: Element): boolean =>
    cleanText(el).length > 0 || FALLBACK_ATTRS.some(a => el.hasAttribute(a))

// What to show in the checklist preview for an element with no text of its
// own (an <img>'s src, an <a>'s href, ...) — whatever attribute its default
// extract mode would actually pull.
const previewOf = (el: Element, extract: ExtractMode): string => {
    const text = cleanText(el)
    if (text) return truncate(text)
    if (extract.kind === 'attr') {
        const value = el.getAttribute(extract.name)
        return value ? truncate(`${extract.name}="${value}"`) : '(empty)'
    }
    return '(empty)'
}

// True leaf elements (no element children) with their own text or a
// meaningful attribute — descends past wrapper elements rather than
// treating them as one big candidate, so e.g. <td><a><img></a></td> yields
// the <img> (an element with no children, but a real src attribute), not
// just its textless <a> parent.
const collectLeaves = (root: Element): Element[] => {
    const out: Element[] = []
    const walk = (el: Element) => {
        for (const child of Array.from(el.children)) {
            if (out.length >= MAX_RAW) return
            if (child.children.length === 0) {
                if (hasExtractableContent(child)) out.push(child)
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
        ? Array.from(item.children)
            .filter(c => c.tagName === 'TD' || c.tagName === 'TH')
            // A cell with its own text (even across inline tags like <b>) is
            // best kept whole. A cell whose only content is e.g. a bare
            // <img> has nothing directly on it worth extracting — descend to
            // the actual leaf (the <img>, with its src) instead of the cell.
            .map(cell => (hasExtractableContent(cell) ? cell : (collectLeaves(cell)[0] ?? cell)))
        : collectLeaves(item)

    const trimmed = raw.slice(0, MAX_CANDIDATES)
    const names = dedupeNames(trimmed.map((c, i) => suggestName(c, i + 1)))
    return trimmed.map((el, i) => {
        const extract = defaultExtractModeFor(el)
        return {
            tag: el.tagName.toLowerCase(),
            selector: relativeSelector(el, item),
            suggestedName: names[i],
            preview: previewOf(el, extract),
            extract,
        }
    })
}
