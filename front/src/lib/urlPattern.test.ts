import { describe, expect, it } from 'vitest'
import { suggestUrlTemplate } from './urlPattern'

describe('suggestUrlTemplate', () => {
    it('templates a ?page= query param', () => {
        expect(suggestUrlTemplate('https://example.com/list?page=3&sort=asc'))
            .toBe('https://example.com/list?page={page}&sort=asc')
    })

    it('templates a /page-N.html path', () => {
        expect(suggestUrlTemplate('https://books.toscrape.com/catalogue/page-2.html'))
            .toBe('https://books.toscrape.com/catalogue/page-{page}.html')
    })

    it('templates a /page/N/ path', () => {
        expect(suggestUrlTemplate('https://example.com/blog/page/5/'))
            .toBe('https://example.com/blog/page/{page}/')
    })

    it('returns null when no page-like number is found', () => {
        expect(suggestUrlTemplate('https://example.com/')).toBeNull()
        expect(suggestUrlTemplate('https://example.com/about')).toBeNull()
    })
})
