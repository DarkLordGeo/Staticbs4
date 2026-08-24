// Shared types for the visual bs4-function builder.
//
// Models the *forms* — what a function is named, what category it is, and
// what element(s)/options it's configured with — plus enough of a CSS
// selector on each picked element for `../lib/codegen.ts` to turn the whole
// thing into real BeautifulSoup code.

export type ElementRef = { tag: string; html: string; selector: string }

export type FnCategory = 'header' | 'text' | 'links' | 'list' | 'table' | 'pagination'

export type ListField = { id: string; name: string; ref: ElementRef }

// Pagination has two independent strategies: follow a picked "next page"
// link element (works for any markup, but needs the link to actually be
// there and findable), or step through a URL template with a page number —
// most real pagination is actually just `?page=N` or `/page-N.html` in the
// URL, which a template covers without needing to click through the DOM at
// all, and generalizes better since it doesn't depend on there being a
// "next" link on the last page.
export type PaginationConfig =
    | { mode: 'link'; next: ElementRef | null }
    | { mode: 'url_pattern'; urlTemplate: string; startPage: number; endPage: number }

export type FnConfig =
    | { category: 'header'; target: ElementRef | null }
    | { category: 'text'; target: ElementRef | null; mode: 'text' | 'html' }
    | { category: 'links'; container: ElementRef | null; extract: 'text' | 'href' | 'both' }
    | { category: 'list'; item: ElementRef | null; fields: ListField[] }
    | { category: 'table'; table: ElementRef | null; firstRowIsHeader: boolean }
    | ({ category: 'pagination' } & PaginationConfig)

export type FnGroup = { id: string; name: string; config: FnConfig }

export const CATEGORY_LABELS: Record<FnCategory, string> = {
    header: 'Header / Title',
    text: 'Text block',
    links: 'Links',
    list: 'List',
    table: 'Table',
    pagination: 'Pagination',
}

// What the "pick element" button should call this category's main slot.
// (Pagination's 'url_pattern' mode has no element to pick at all — see
// FunctionBuilderPanel, which renders a template/page-range form instead.)
export const MAIN_SLOT_LABELS: Record<FnCategory, string> = {
    header: 'Target element',
    text: 'Target element',
    links: 'Container element',
    list: 'Item element (one repeating card/row)',
    table: 'Table element',
    pagination: 'Next-page element',
}

export const emptyConfigFor = (category: FnCategory): FnConfig => {
    switch (category) {
        case 'header': return { category, target: null }
        case 'text': return { category, target: null, mode: 'text' }
        case 'links': return { category, container: null, extract: 'text' }
        case 'list': return { category, item: null, fields: [] }
        case 'table': return { category, table: null, firstRowIsHeader: true }
        case 'pagination': return { category, mode: 'link', next: null }
    }
}

export const isConfigComplete = (config: FnConfig): boolean => {
    switch (config.category) {
        case 'header': return config.target !== null
        case 'text': return config.target !== null
        case 'links': return config.container !== null
        case 'list': return config.item !== null && config.fields.length > 0
        case 'table': return config.table !== null
        case 'pagination':
            return config.mode === 'link'
                ? config.next !== null
                : config.urlTemplate.includes('{page}') && config.endPage >= config.startPage
    }
}

export const summarizeFn = (fn: FnGroup): string => {
    const c = fn.config
    switch (c.category) {
        case 'header': return c.target ? `<${c.target.tag}>` : 'no target'
        case 'text': return `${c.target ? `<${c.target.tag}>` : 'no target'} · ${c.mode}`
        case 'links': return `${c.container ? `<${c.container.tag}>` : 'no container'} · extract ${c.extract}`
        case 'list': return `${c.item ? `<${c.item.tag}>` : 'no item'} · ${c.fields.length} field${c.fields.length === 1 ? '' : 's'}`
        case 'table': return `${c.table ? '<table>' : 'no table'} · header row: ${c.firstRowIsHeader ? 'yes' : 'no'}`
        case 'pagination':
            return c.mode === 'link'
                ? (c.next ? `<${c.next.tag}>` : 'no target')
                : `pages ${c.startPage}–${c.endPage} · ${c.urlTemplate || 'no template'}`
    }
}
