import { describe, expect, it } from 'vitest'
import { runExtraction } from './extract'
import type { ElementRef, FnConfig, ListField } from '../types/builder'
import type { FnGroup } from '../types/builder'

const ref = (selector: string, tag = 'div'): ElementRef => ({ tag, html: '', selector })
const setBody = (html: string) => { document.body.innerHTML = html }
const header = (target: ElementRef | null): FnConfig => ({ category: 'header', target, extract: { kind: 'text' } })
const field = (name: string, fieldRef: ElementRef): ListField => ({ id: name, name, ref: fieldRef, extract: { kind: 'text' } })

describe('runExtraction', () => {
    it('extracts header text', () => {
        setBody('<h1>Hello World</h1>')
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: header(ref('h1')) }]
        expect(runExtraction(document, functions).get_title).toEqual({ ok: true, value: 'Hello World' })
    })

    it('extracts inner HTML for a text function in html mode', () => {
        setBody('<p>Hello <b>World</b></p>')
        const functions: FnGroup[] = [{
            id: '1', name: 'get_body',
            config: { category: 'text', target: ref('p'), extract: { kind: 'html' } },
        }]
        expect(runExtraction(document, functions).get_body).toEqual({ ok: true, value: 'Hello <b>World</b>' })
    })

    it('extracts an attribute for a header function — e.g. an <img> has no text, only a src', () => {
        setBody('<img id="logo" src="/logo.png" alt="Logo">')
        const functions: FnGroup[] = [{
            id: '1', name: 'get_logo_src',
            config: { category: 'header', target: ref('#logo', 'img'), extract: { kind: 'attr', name: 'src' } },
        }]
        expect(runExtraction(document, functions).get_logo_src).toEqual({ ok: true, value: '/logo.png' })
    })

    it('extracts a list with nested fields', () => {
        setBody(`
            <table><tbody>
                <tr><td>Alice</td></tr>
                <tr><td>Bob</td></tr>
            </tbody></table>
        `)
        const functions: FnGroup[] = [{
            id: '1', name: 'get_rows',
            config: { category: 'list', item: ref('tr'), fields: [field('name', ref('td', 'td'))] },
        }]
        expect(runExtraction(document, functions).get_rows).toEqual({
            ok: true,
            value: [{ name: 'Alice' }, { name: 'Bob' }],
        })
    })

    it('extracts an attribute for a list field — an <img> nested inside an <a>', () => {
        setBody(`
            <ul>
                <li><a href="/p/1"><img class="thumb" src="/a.jpg"></a><span class="name">A</span></li>
                <li><a href="/p/2"><img class="thumb" src="/b.jpg"></a><span class="name">B</span></li>
            </ul>
        `)
        const functions: FnGroup[] = [{
            id: '1', name: 'get_items',
            config: {
                category: 'list',
                item: ref('li'),
                fields: [
                    { id: 'f1', name: 'name', ref: ref('span.name', 'span'), extract: { kind: 'text' } },
                    { id: 'f2', name: 'thumb', ref: ref('img.thumb', 'img'), extract: { kind: 'attr', name: 'src' } },
                    { id: 'f3', name: 'href', ref: ref('a', 'a'), extract: { kind: 'attr', name: 'href' } },
                ],
            },
        }]
        expect(runExtraction(document, functions).get_items).toEqual({
            ok: true,
            value: [
                { name: 'A', thumb: '/a.jpg', href: '/p/1' },
                { name: 'B', thumb: '/b.jpg', href: '/p/2' },
            ],
        })
    })

    it('extracts links by text, href, or both', () => {
        setBody('<nav><a href="/a">A</a><a href="/b">B</a></nav>')
        const functions: FnGroup[] = [
            { id: '1', name: 'texts', config: { category: 'links', container: ref('nav'), extract: 'text' } },
            { id: '2', name: 'hrefs', config: { category: 'links', container: ref('nav'), extract: 'href' } },
            { id: '3', name: 'both', config: { category: 'links', container: ref('nav'), extract: 'both' } },
        ]
        const result = runExtraction(document, functions)
        expect(result.texts).toEqual({ ok: true, value: ['A', 'B'] })
        expect(result.hrefs).toEqual({ ok: true, value: ['/a', '/b'] })
        expect(result.both).toEqual({ ok: true, value: [{ text: 'A', href: '/a' }, { text: 'B', href: '/b' }] })
    })

    it('extracts a table with the first row as a header', () => {
        setBody(`
            <table><tbody>
                <tr><th>Name</th><th>Age</th></tr>
                <tr><td>Alice</td><td>30</td></tr>
            </tbody></table>
        `)
        const functions: FnGroup[] = [{
            id: '1', name: 'get_table',
            config: { category: 'table', table: ref('table'), firstRowIsHeader: true },
        }]
        expect(runExtraction(document, functions).get_table).toEqual({
            ok: true,
            value: [{ Name: 'Alice', Age: '30' }],
        })
    })

    it('extracts a pagination href', () => {
        setBody('<a id="next" href="/page/2">Next</a>')
        const functions: FnGroup[] = [{ id: '1', name: 'get_next', config: { category: 'pagination', mode: 'link', next: ref('#next', 'a') } }]
        expect(runExtraction(document, functions).get_next).toEqual({ ok: true, value: '/page/2' })
    })

    it('reports an error for an incomplete config instead of throwing', () => {
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: header(null) }]
        const result = runExtraction(document, functions)
        expect(result.get_title.ok).toBe(false)
    })

    it('returns null when the selector matches nothing, rather than throwing', () => {
        setBody('<div></div>')
        const functions: FnGroup[] = [{ id: '1', name: 'get_title', config: header(ref('h1')) }]
        expect(runExtraction(document, functions).get_title).toEqual({ ok: true, value: null })
    })

    it('previews the next resolved URL for url_pattern pagination', () => {
        const functions: FnGroup[] = [{
            id: '1', name: 'paginate',
            config: { category: 'pagination', mode: 'url_pattern', urlTemplate: 'https://example.com/page-{page}.html', startPage: 1, endPage: 5 },
        }]
        expect(runExtraction(document, functions).paginate).toEqual({
            ok: true,
            value: 'https://example.com/page-2.html',
        })
    })
})
