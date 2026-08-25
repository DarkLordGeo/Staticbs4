import { describe, expect, it, beforeEach } from 'vitest'
import { clearWorkspace, loadWorkspace, saveWorkspace } from './persistence'

beforeEach(() => localStorage.clear())

describe('workspace persistence', () => {
    it('round-trips a saved workspace', () => {
        saveWorkspace({
            url: 'https://example.com',
            functions: [{
                id: '1', name: 'get_title',
                config: { category: 'header', target: { tag: 'h1', html: '<h1></h1>', selector: 'h1' }, extract: { kind: 'text' } },
            }],
        })
        expect(loadWorkspace()).toEqual({
            url: 'https://example.com',
            functions: [{
                id: '1', name: 'get_title',
                config: { category: 'header', target: { tag: 'h1', html: '<h1></h1>', selector: 'h1' }, extract: { kind: 'text' } },
            }],
        })
    })

    it('returns null when nothing is saved', () => {
        expect(loadWorkspace()).toBeNull()
    })

    it('clears a saved workspace', () => {
        saveWorkspace({ url: 'https://example.com', functions: [] })
        clearWorkspace()
        expect(loadWorkspace()).toBeNull()
    })

    it('migrates a pre-ExtractMode header/text config saved by an older version', () => {
        localStorage.setItem('visualbs4scraper:workspace', JSON.stringify({
            url: 'https://example.com',
            functions: [
                { id: '1', name: 'get_title', config: { category: 'header', target: { tag: 'h1', html: '', selector: 'h1' } } },
                { id: '2', name: 'get_body', config: { category: 'text', target: { tag: 'p', html: '', selector: 'p' }, mode: 'html' } },
            ],
        }))
        const workspace = loadWorkspace()
        expect(workspace?.functions[0].config).toMatchObject({ extract: { kind: 'text' } })
        expect(workspace?.functions[1].config).toMatchObject({ extract: { kind: 'html' } })
    })

    it('migrates pre-ExtractMode list fields saved by an older version', () => {
        localStorage.setItem('visualbs4scraper:workspace', JSON.stringify({
            url: 'https://example.com',
            functions: [{
                id: '1', name: 'get_items',
                config: {
                    category: 'list',
                    item: { tag: 'li', html: '', selector: 'li' },
                    fields: [{ id: 'f1', name: 'title', ref: { tag: 'span', html: '', selector: 'span' } }],
                },
            }],
        }))
        const workspace = loadWorkspace()
        const config = workspace?.functions[0].config
        expect(config?.category).toBe('list')
        expect(config?.category === 'list' && config.fields[0].extract).toEqual({ kind: 'text' })
    })

    it('returns null for corrupted JSON instead of throwing', () => {
        localStorage.setItem('visualbs4scraper:workspace', '{not json')
        expect(loadWorkspace()).toBeNull()
    })
})
