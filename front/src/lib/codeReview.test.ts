import { describe, expect, it } from 'vitest'
import { reviewFunctions } from './codeReview'
import type { ElementRef, FnGroup } from '../types/builder'

const ref = (selector: string, html: string, tag = 'div'): ElementRef => ({ tag, html, selector })

describe('reviewFunctions', () => {
    it('flags a fragile :nth-of-type selector', () => {
        const functions: FnGroup[] = [{
            id: '1', name: 'get_title',
            config: { category: 'header', target: ref('div:nth-of-type(3) > h1', '<h1></h1>'), extract: { kind: 'text' } },
        }]
        const findings = reviewFunctions(functions)
        expect(findings).toHaveLength(1)
        expect(findings[0].severity).toBe('warning')
        expect(findings[0].message).toContain('get_title')
        expect(findings[0].message).toContain(':nth-of-type')
    })

    it('does not flag a selector with no :nth-of-type', () => {
        const functions: FnGroup[] = [{
            id: '1', name: 'get_title',
            config: { category: 'header', target: ref('h1.title', '<h1 class="title"></h1>'), extract: { kind: 'text' } },
        }]
        expect(reviewFunctions(functions)).toHaveLength(0)
    })

    it('suggests a stabler attribute when the element actually has one', () => {
        const functions: FnGroup[] = [{
            id: '1', name: 'get_title',
            config: { category: 'header', target: ref('div:nth-of-type(2) > h1', '<h1 id="main-title"></h1>'), extract: { kind: 'text' } },
        }]
        const [finding] = reviewFunctions(functions)
        expect(finding.message).toContain('id="main-title"')
    })

    it('does not fabricate a suggestion when no stabler attribute exists', () => {
        const functions: FnGroup[] = [{
            id: '1', name: 'get_title',
            config: { category: 'header', target: ref('div:nth-of-type(2) > h1', '<h1></h1>'), extract: { kind: 'text' } },
        }]
        const [finding] = reviewFunctions(functions)
        expect(finding.message).not.toContain('consider selecting by that instead')
    })

    it('flags a fragile selector on a specific list field, naming it', () => {
        const functions: FnGroup[] = [{
            id: '1', name: 'get_items',
            config: {
                category: 'list',
                item: ref('li', '<li></li>'),
                fields: [{ id: 'f1', name: 'price', ref: ref('span:nth-of-type(2)', '<span></span>'), extract: { kind: 'text' } }],
            },
        }]
        const [finding] = reviewFunctions(functions)
        expect(finding.message).toContain('field "price"')
    })

    it('skips functions with no selector at all (incomplete configs) instead of crashing', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: { category: 'header', target: null, extract: { kind: 'text' } } }]
        expect(reviewFunctions(functions)).toHaveLength(0)
    })

    it('returns no findings for a clean set of functions', () => {
        const functions: FnGroup[] = [
            { id: '1', name: 'get_title', config: { category: 'header', target: ref('h1.title', '<h1 class="title"></h1>'), extract: { kind: 'text' } } },
            { id: '2', name: 'get_items', config: { category: 'list', item: ref('li.card', '<li class="card"></li>'), fields: [] } },
        ]
        expect(reviewFunctions(functions)).toHaveLength(0)
    })
})
