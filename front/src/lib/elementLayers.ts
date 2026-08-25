// Building blocks for the "layer picker" — a click gives you exactly the
// element under the cursor, but the thing you actually want is often an
// ancestor (the <a> wrapping what you clicked) or a descendant (the <img>
// inside the <a> you clicked). This lets the UI offer both directions
// instead of being stuck with whatever the click literally hit.

import type { ExtractMode } from '../types/builder'

// Climbs from `start` up through parentElement, returning the chain from
// the topmost kept ancestor down to `start` itself. Stops at <body>/<html>
// or once `maxDepth` elements are collected — either one keeps the
// breadcrumb from growing into the entire document for a deeply nested pick.
export const ancestorChain = (start: Element, maxDepth = 6): Element[] => {
    const chain: Element[] = [start]
    let el: Element | null = start
    while (chain.length < maxDepth) {
        el = el.parentElement
        if (!el || el.tagName === 'BODY' || el.tagName === 'HTML') break
        chain.unshift(el)
    }
    return chain
}

// Direct child *elements* of `el`, deduplicated by tag (first occurrence
// wins) — feeds the "contains" chips that let a pick descend into e.g. the
// <img> inside a clicked <a>. Capped so a container with dozens of children
// doesn't produce an unusable chip row.
export const childElementCandidates = (el: Element, maxChips = 8): Element[] => {
    const seen = new Set<string>()
    const out: Element[] = []
    for (const child of Array.from(el.children)) {
        const tag = child.tagName.toLowerCase()
        if (seen.has(tag)) continue
        seen.add(tag)
        out.push(child)
        if (out.length >= maxChips) break
    }
    return out
}

// Attribute names actually present on `el`, in DOM order — feeds the
// "extract this attribute" dropdown with only options that are real, rather
// than a fixed guess list that may not apply to this element.
export const attributeNamesOf = (el: Element): string[] => Array.from(el.attributes).map(a => a.name)

// A reasonable default extraction mode for an element. Most elements are
// about their text, but some common attribute-only elements — an <img> has
// no useful text at all — are almost always about one specific attribute
// instead, so default to that instead of an empty string.
export const defaultExtractModeFor = (el: Element): ExtractMode => {
    const tag = el.tagName.toLowerCase()
    if ((tag === 'img' || tag === 'source' || tag === 'iframe') && el.hasAttribute('src')) {
        return { kind: 'attr', name: 'src' }
    }
    if (tag === 'a' && !(el.textContent ?? '').trim() && el.hasAttribute('href')) {
        return { kind: 'attr', name: 'href' }
    }
    if ((tag === 'input' || tag === 'option') && el.hasAttribute('value')) {
        return { kind: 'attr', name: 'value' }
    }
    if (tag === 'meta' && el.hasAttribute('content')) {
        return { kind: 'attr', name: 'content' }
    }
    return { kind: 'text' }
}
