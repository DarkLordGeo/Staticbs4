// A deterministic, no-network "linter" for what the generator is about to
// produce — the generator already knows exactly what it emitted and why, so
// flagging likely problems is just inspecting the functions that fed it,
// not a separate analysis pass over the output text.

import type { FnGroup } from '../types/builder'

export type ReviewFinding = {
    id: string
    severity: 'warning' | 'info'
    message: string
}

// Every selector a function actually uses, labeled by what it's for — so a
// finding can say *which* selector on *which* function, not just "somewhere
// in here". A `null` selector (incomplete config) is skipped by the caller,
// not flagged here — that's what "incomplete" already covers elsewhere.
const selectorsOf = (fn: FnGroup): { label: string; selector: string | null }[] => {
    const c = fn.config
    switch (c.category) {
        case 'header': return [{ label: 'target', selector: c.target?.selector ?? null }]
        case 'text': return [{ label: 'target', selector: c.target?.selector ?? null }]
        case 'links': return [{ label: 'container', selector: c.container?.selector ?? null }]
        case 'list': return [
            { label: 'item', selector: c.item?.selector ?? null },
            ...c.fields.map(f => ({ label: `field "${f.name}"`, selector: f.ref.selector })),
        ]
        case 'table': return [{ label: 'table', selector: c.table?.selector ?? null }]
        case 'pagination': return c.mode === 'link' ? [{ label: 'next-page target', selector: c.next?.selector ?? null }] : []
    }
}

// A minimal check for whether a selector could plausibly have used a
// stabler alternative instead — parsed from the element's own stored
// outerHTML, so this only ever suggests something that's actually there,
// never a guess. Ancestors aren't inspected (only this element's own
// attributes are available), so this can under-report, never over-promise.
const stablerAttrHint = (html: string): string | null => {
    try {
        const el = new DOMParser().parseFromString(html, 'text/html').body.firstElementChild
        if (!el) return null
        if (el.id) return `id="${el.id}"`
        const testId = el.getAttribute('data-testid')
        if (testId) return `[data-testid="${testId}"]`
        const ariaLabel = el.getAttribute('aria-label')
        if (ariaLabel) return `[aria-label="${ariaLabel}"]`
        return null
    } catch {
        return null
    }
}

export const reviewFunctions = (functions: FnGroup[]): ReviewFinding[] => {
    const findings: ReviewFinding[] = []

    for (const fn of functions) {
        for (const { label, selector } of selectorsOf(fn)) {
            if (!selector || !/:nth-of-type/.test(selector)) continue

            // Find the matching ElementRef to look for a stabler attribute —
            // a little redundant with selectorsOf, but keeps that helper
            // returning plain selector strings for the common case.
            const c = fn.config
            const ref = c.category === 'list' && label.startsWith('field')
                ? c.fields.find(f => `field "${f.name}"` === label)?.ref
                : c.category === 'header' || c.category === 'text' ? c.target
                    : c.category === 'links' ? c.container
                        : c.category === 'list' ? c.item
                            : c.category === 'table' ? c.table
                                : c.category === 'pagination' && c.mode === 'link' ? c.next
                                    : null

            const hint = ref ? stablerAttrHint(ref.html) : null
            findings.push({
                id: `fragile-${fn.id}-${label}`,
                severity: 'warning',
                message: hint
                    ? `${fn.name}'s ${label} selector relies on element position (:nth-of-type) — it breaks if the page adds/removes a sibling. This element has ${hint}; consider selecting by that instead.`
                    : `${fn.name}'s ${label} selector relies on element position (:nth-of-type) — it breaks if the page adds/removes a sibling element.`,
            })
        }
    }

    return findings
}
