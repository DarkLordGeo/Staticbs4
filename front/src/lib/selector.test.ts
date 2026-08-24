import { describe, expect, it } from 'vitest'
import { absoluteSelector, fieldSelectorFor, groupSelector, nearestRepeatingElement, relativeSelector } from './selector'
import type { FnConfig } from '../types/builder'

const setBody = (html: string) => { document.body.innerHTML = html }

describe('absoluteSelector', () => {
    it('uses an id shortcut when the element has one', () => {
        setBody('<div><h1 id="title">Hello</h1></div>')
        expect(absoluteSelector(document.getElementById('title')!)).toBe('#title')
    })

    it('builds a tag+class path with no index when unambiguous', () => {
        setBody('<div class="wrap"><h1 class="headline">Hi</h1></div>')
        expect(absoluteSelector(document.querySelector('h1')!)).toBe('body > div.wrap > h1.headline')
    })

    it('adds :nth-of-type only when tag+class alone is ambiguous', () => {
        setBody('<ul><li class="item">a</li><li class="item">b</li></ul>')
        const [first, second] = document.querySelectorAll('li.item')
        expect(absoluteSelector(first)).toBe('body > ul > li.item:nth-of-type(1)')
        expect(absoluteSelector(second)).toBe('body > ul > li.item:nth-of-type(2)')
    })

    it('does not index when a class already disambiguates from siblings', () => {
        setBody('<div><span class="a">x</span><span class="b">y</span></div>')
        expect(absoluteSelector(document.querySelector('span.a')!)).toBe('body > div > span.a')
    })
})

describe('groupSelector', () => {
    // Regression case: bare <tr> rows share no class, so the old logic
    // (which always disambiguated) locked onto one row via :nth-of-type and
    // broke the entire point of picking a repeating list item.
    it('never indexes the picked element itself, so it matches every sibling', () => {
        setBody(`
            <table><tbody>
                <tr><td>1</td></tr>
                <tr><td>2</td></tr>
                <tr><td>3</td></tr>
            </tbody></table>
        `)
        const selector = groupSelector(document.querySelectorAll('tr')[0])
        expect(selector).not.toMatch(/:nth-of-type/)
        expect(document.querySelectorAll(selector)).toHaveLength(3)
    })

    it('still disambiguates ancestor context normally, so it stays scoped', () => {
        setBody(`
            <div>
                <ul class="a"><li>x</li></ul>
                <ul class="b"><li>y</li><li>z</li></ul>
            </div>
        `)
        const selector = groupSelector(document.querySelectorAll('ul.b li')[0])
        expect(document.querySelectorAll(selector)).toHaveLength(2)
    })
})

describe('relativeSelector', () => {
    it('builds a path relative to a given ancestor, excluding it', () => {
        setBody('<div class="item"><h2 class="title">Hi</h2></div>')
        const root = document.querySelector('.item')!
        expect(relativeSelector(document.querySelector('.title')!, root)).toBe('h2.title')
    })
})

describe('nearestRepeatingElement', () => {
    // Regression case: a click on a list "item" almost always lands on inner
    // content (a cell, a heading), not the item itself.
    it('climbs from a table cell to its row', () => {
        setBody(`
            <table><tbody>
                <tr><td>a</td><td>b</td></tr>
                <tr><td>c</td><td>d</td></tr>
            </tbody></table>
        `)
        const result = nearestRepeatingElement(document.querySelectorAll('td')[0])
        expect(result.tagName.toLowerCase()).toBe('tr')
    })

    it('climbs from inner content (a heading) up to the repeating card', () => {
        setBody(`
            <div class="grid">
                <div class="card"><h2>One</h2></div>
                <div class="card"><h2>Two</h2></div>
            </div>
        `)
        const result = nearestRepeatingElement(document.querySelectorAll('h2')[0])
        expect(result.classList.contains('card')).toBe(true)
    })

    it('falls back to the clicked element when nothing in the chain repeats', () => {
        setBody('<div><span id="lonely">only one</span></div>')
        const el = document.getElementById('lonely')!
        expect(nearestRepeatingElement(el)).toBe(el)
    })
})

describe('fieldSelectorFor', () => {
    it('builds a selector relative to the item, resolving against any matching item', () => {
        setBody(`
            <ul>
                <li class="row"><span class="name">Alice</span></li>
                <li class="row"><span class="name">Bob</span></li>
            </ul>
        `)
        const config: FnConfig = {
            category: 'list',
            item: { tag: 'li', html: '', selector: 'ul > li.row' },
            fields: [],
        }
        const selector = fieldSelectorFor(document.querySelectorAll('.name')[0], config)
        expect(selector).toBe('span.name')
        expect(document.querySelectorAll('li.row')[1].querySelector(selector)!.textContent).toBe('Bob')
    })

    it('falls back to an absolute selector when there is no item selector yet', () => {
        setBody('<div><span id="x">hi</span></div>')
        const config: FnConfig = { category: 'list', item: null, fields: [] }
        expect(fieldSelectorFor(document.getElementById('x')!, config)).toBe('#x')
    })
})
