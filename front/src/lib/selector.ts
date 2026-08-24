// Turns a clicked DOM element into a CSS selector that BeautifulSoup's
// `.select()` / `.select_one()` can use — this is what makes the generated
// Python code actually point at the right element(s).

import type { FnConfig } from '../types/builder'

const cssEscape = (s: string): string =>
    typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&')

// One path segment for `el`: tag + classes, plus (when `allowIndex`) a
// disambiguating :nth-of-type(...) — but *only* when tag+classes alone
// doesn't already pick `el` out uniquely among its siblings. This matters a
// lot for repeating list items: sibling <li class="card"> elements share the
// same tag+class, so no index gets added and the selector naturally matches
// all of them.
const segment = (el: Element, allowIndex = true): string => {
    const classes = Array.from(el.classList).filter(Boolean)
    let sel = el.tagName.toLowerCase()
    if (classes.length) sel += '.' + classes.map(cssEscape).join('.')

    if (!allowIndex) return sel

    const parent = el.parentElement
    if (!parent) return sel

    const sameTag = Array.from(parent.children).filter(s => s.tagName === el.tagName)
    const sameCompound = sameTag.filter(s => {
        const c = Array.from(s.classList).filter(Boolean)
        return c.length === classes.length && classes.every(cls => c.includes(cls))
    })
    if (sameCompound.length > 1) {
        sel += `:nth-of-type(${sameTag.indexOf(el) + 1})`
    }
    return sel
}

// Full selector from the document root down to `el`, short-circuiting on the
// nearest ancestor id (ids are assumed unique, same as the browser does).
export const absoluteSelector = (el: Element): string => {
    const parts: string[] = []
    let node: Element | null = el
    while (node && node.tagName.toLowerCase() !== 'html') {
        if (node.id) {
            parts.unshift(`#${cssEscape(node.id)}`)
            break
        }
        parts.unshift(segment(node))
        node = node.parentElement
    }
    return parts.join(' > ')
}

// Selector for a *group* of repeated elements (a list's "item" template),
// built from one example click. Same path-building as absoluteSelector, but
// the clicked element itself never gets an :nth-of-type or an #id lock —
// both would pin the selector to that one instance instead of matching every
// sibling in the group (e.g. every <tr> in a jobs table, which usually share
// no distinguishing class at all). Ancestor segments still disambiguate
// normally, so the group stays scoped to the right container.
export const groupSelector = (el: Element): string => {
    const parts: string[] = [segment(el, false)]
    let node: Element | null = el.parentElement
    while (node && node.tagName.toLowerCase() !== 'html') {
        if (node.id) {
            parts.unshift(`#${cssEscape(node.id)}`)
            break
        }
        parts.unshift(segment(node))
        node = node.parentElement
    }
    return parts.join(' > ')
}

// Selector for `el` relative to an ancestor `root` (exclusive) — used for
// fields picked inside a repeating list item, so the field selector reads as
// "within one item" rather than "this exact element in the whole document".
export const relativeSelector = (el: Element, root: Element): string => {
    const parts: string[] = []
    let node: Element | null = el
    while (node && node !== root) {
        parts.unshift(segment(node))
        node = node.parentElement
    }
    return parts.join(' > ')
}

const elementMatches = (el: Element, selector: string): boolean => {
    try {
        return el.matches(selector)
    } catch {
        return false // invalid/unsupported selector — caller falls back to absolute
    }
}

// True if `el` has at least one sibling of the same tag+classes — i.e. this
// nesting level looks like part of a repeating group.
const isRepeated = (el: Element): boolean => {
    const parent = el.parentElement
    if (!parent) return false
    const classes = Array.from(el.classList).filter(Boolean)
    return Array.from(parent.children).some(s => {
        if (s === el || s.tagName !== el.tagName) return false
        if (classes.length === 0) return true
        const c = Array.from(s.classList).filter(Boolean)
        return c.length === classes.length && classes.every(cls => c.includes(cls))
    })
}

const isBoundary = (el: Element): boolean => {
    const tag = el.tagName.toLowerCase()
    return tag === 'body' || tag === 'html'
}

// A click inside a repeating row/card almost never lands on the row/card
// itself — it lands on whatever's rendered under the cursor (a table cell's
// text, a heading inside a card, ...). This climbs from that click target to
// the actual repeating boundary, so picking a list "item" works the way it
// looks like it should: click anywhere in one row, get the whole group.
//
// Two-phase climb: first reach *any* ancestor (possibly the target itself)
// that repeats among its own siblings — a <td> already qualifies, since a
// row's other cells share its tag. Then keep climbing while the repetition
// continues, so a <td> lands on the outer <tr>, not the first cell it met.
export const nearestRepeatingElement = (target: Element): Element => {
    let node: Element | null = target
    while (node && !isBoundary(node) && !isRepeated(node)) {
        node = node.parentElement
    }
    if (!node || isBoundary(node)) return target // nothing in the chain repeats

    let best = node
    let next: Element | null = node.parentElement
    while (next && !isBoundary(next) && isRepeated(next)) {
        best = next
        next = next.parentElement
    }
    return best
}

// Selector to use for a "field" pick (a named sub-element inside a list
// item's template). Walks up from the clicked element to the nearest
// ancestor matching the list's item selector, then builds a selector
// relative to that ancestor. Falls back to an absolute selector if there's
// no item selector yet, or the click landed outside any matching item.
export const fieldSelectorFor = (target: Element, config: FnConfig): string => {
    if (config.category === 'list' && config.item?.selector) {
        let root: Element | null = target
        while (root && !elementMatches(root, config.item.selector)) {
            root = root.parentElement
        }
        if (root && root !== target) {
            return relativeSelector(target, root)
        }
    }
    return absoluteSelector(target)
}
