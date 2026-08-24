import { describe, expect, it } from 'vitest'
import { detectFields } from './autoFields'

const setBody = (html: string) => { document.body.innerHTML = html }

describe('detectFields', () => {
    it('suggests one candidate per cell for a table row, in column order', () => {
        setBody('<table><tbody><tr><td>Alice</td><td>30</td></tr></tbody></table>')
        const row = document.querySelector('tr')!
        const candidates = detectFields(row)
        expect(candidates).toHaveLength(2)
        expect(candidates[0].preview).toBe('Alice')
        expect(candidates[1].preview).toBe('30')
        expect(candidates.every(c => c.tag === 'td')).toBe(true)
    })

    it('resolves each candidate selector correctly relative to the item', () => {
        setBody(`
            <table><tbody>
                <tr><td>Alice</td></tr>
                <tr><td>Bob</td></tr>
            </tbody></table>
        `)
        const [first, second] = document.querySelectorAll('tr')
        const [candidate] = detectFields(first)
        expect(second.querySelector(candidate.selector)!.textContent).toBe('Bob')
    })

    it('descends past wrapper elements to find true leaf text nodes', () => {
        setBody(`
            <div class="card">
                <div class="header"><h2>Title</h2></div>
                <p class="price">£10</p>
            </div>
        `)
        const card = document.querySelector('.card')!
        const candidates = detectFields(card)
        // the h2 (leaf) should be found, not its non-leaf ".header" wrapper
        expect(candidates.some(c => c.tag === 'h2' && c.preview === 'Title')).toBe(true)
        expect(candidates.some(c => c.tag === 'div' && c.preview === 'Title')).toBe(false)
        expect(candidates.some(c => c.tag === 'p' && c.preview === '£10')).toBe(true)
    })

    it('skips elements with no text', () => {
        setBody('<div class="card"><span></span><span>Hi</span></div>')
        const candidates = detectFields(document.querySelector('.card')!)
        expect(candidates).toHaveLength(1)
        expect(candidates[0].preview).toBe('Hi')
    })

    it('names candidates from a distinguishing class, falling back to the tag', () => {
        setBody('<div class="card"><span class="price">£10</span><span>plain</span></div>')
        const [withClass, withoutClass] = detectFields(document.querySelector('.card')!)
        expect(withClass.suggestedName).toBe('price')
        expect(withoutClass.suggestedName).toBe('span')
    })

    it('deduplicates suggested names', () => {
        setBody('<div class="card"><span>a</span><span>b</span></div>')
        const [first, second] = detectFields(document.querySelector('.card')!)
        expect(first.suggestedName).toBe('span')
        expect(second.suggestedName).toBe('span_2')
    })

    it('truncates a long preview', () => {
        setBody(`<div class="card"><p>${'x'.repeat(100)}</p></div>`)
        const [candidate] = detectFields(document.querySelector('.card')!)
        expect(candidate.preview.endsWith('…')).toBe(true)
        expect(candidate.preview.length).toBeLessThan(100)
    })
})
