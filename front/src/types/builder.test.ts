import { describe, expect, it } from 'vitest'
import { isConfigComplete, summarizeFn } from './builder'
import type { ElementRef, FnGroup } from './builder'

const ref = (selector: string, tag = 'div'): ElementRef => ({ tag, html: `<${tag}></${tag}>`, selector })

describe('isConfigComplete', () => {
    it('a List with an item but no fields is complete — whole-item text is a valid, deliberate choice', () => {
        expect(isConfigComplete({ category: 'list', item: ref('li', 'li'), fields: [] })).toBe(true)
    })

    it('a List with no item picked yet is incomplete regardless of fields', () => {
        expect(isConfigComplete({ category: 'list', item: null, fields: [] })).toBe(false)
    })

    it('a List with an item and fields is complete', () => {
        expect(isConfigComplete({
            category: 'list', item: ref('li', 'li'), fields: [{ id: 'f1', name: 'x', ref: ref('span'), extract: { kind: 'text' } }],
        })).toBe(true)
    })

    it('header/text need a target', () => {
        expect(isConfigComplete({ category: 'header', target: null, extract: { kind: 'text' } })).toBe(false)
        expect(isConfigComplete({ category: 'header', target: ref('h1'), extract: { kind: 'text' } })).toBe(true)
    })
})

describe('summarizeFn', () => {
    it('describes a fieldless List as whole item text, not "0 fields"', () => {
        const fn: FnGroup = { id: '1', name: 'get_items', config: { category: 'list', item: ref('li', 'li'), fields: [] } }
        expect(summarizeFn(fn)).toBe('<li> · whole item text')
    })

    it('describes a List with fields by count', () => {
        const fn: FnGroup = {
            id: '1', name: 'get_items',
            config: { category: 'list', item: ref('li', 'li'), fields: [{ id: 'f1', name: 'x', ref: ref('span'), extract: { kind: 'text' } }] },
        }
        expect(summarizeFn(fn)).toBe('<li> · 1 field')
    })
})
