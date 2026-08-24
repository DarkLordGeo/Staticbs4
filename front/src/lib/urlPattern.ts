// Best-effort suggestion for a pagination URL template: find the number in
// the URL most likely to be a page number and swap it for a {page}
// placeholder. Not required — the field stays freely editable — just saves
// typing for the common case (?page=2, /page-2.html, /page/2/, ...).

const PAGE_NUMBER_PATTERNS = [
    /([?&]page=)(\d+)/i,
    /(\/page[-/])(\d+)/i,
    /(page[-_])(\d+)(?=\.\w+$)/i, // page-2.html
]

export const suggestUrlTemplate = (url: string): string | null => {
    for (const pattern of PAGE_NUMBER_PATTERNS) {
        if (pattern.test(url)) {
            return url.replace(pattern, (_match, prefix: string) => `${prefix}{page}`)
        }
    }
    return null
}
