// Autosaves the workspace (URL + built functions) to localStorage, so
// picking elements survives a refresh. Deliberately excludes the fetched
// page's raw HTML (siteValue) — that can be multiple MB for a real site, way
// more than worth spending localStorage quota on, and the preview needs a
// live iframe load anyway; a restored session just needs "Get Website
// content" clicked again, which every affected feature already tolerates
// gracefully (Run is disabled, group highlighting no-ops) until then.

import type { ExtractMode, FnGroup } from '../types/builder'
import { defaultExtractMode } from '../types/builder'

const STORAGE_KEY = 'visualbs4scraper:workspace'

export type PersistedWorkspace = { url: string; functions: FnGroup[] }

// A workspace saved before ExtractMode existed has header/text configs with
// no `extract` at all (text had a `mode: 'text' | 'html'` instead, header
// had nothing — it was always plain text), and list fields with no
// `extract` either. Without this, loading an old saved session would leave
// those configs missing a field the rest of the app now assumes is always
// present, instead of just quietly defaulting it back to plain text like it
// always effectively was.
type LegacyExtractish = { extract?: unknown; mode?: unknown }
const normalizeExtract = (config: LegacyExtractish): ExtractMode => {
    const extract = config.extract
    if (extract && typeof extract === 'object' && typeof (extract as { kind?: unknown }).kind === 'string') {
        return extract as ExtractMode
    }
    if (config.mode === 'html') return { kind: 'html' }
    return defaultExtractMode
}

const normalizeFunctions = (functions: FnGroup[]): FnGroup[] =>
    functions.map(fn => {
        const config = fn.config as FnGroup['config'] & LegacyExtractish & { fields?: (LegacyExtractish & Record<string, unknown>)[] }
        if (config.category === 'header' || config.category === 'text') {
            return { ...fn, config: { ...config, extract: normalizeExtract(config) } }
        }
        if (config.category === 'list') {
            return {
                ...fn,
                config: {
                    ...config,
                    fields: (config.fields ?? []).map(f => ({ ...f, extract: normalizeExtract(f) })),
                },
            }
        }
        return fn
    }) as FnGroup[]

export const loadWorkspace = (): PersistedWorkspace | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed: unknown = JSON.parse(raw)
        if (
            typeof parsed !== 'object' || parsed === null ||
            typeof (parsed as PersistedWorkspace).url !== 'string' ||
            !Array.isArray((parsed as PersistedWorkspace).functions)
        ) {
            return null
        }
        const workspace = parsed as PersistedWorkspace
        return { ...workspace, functions: normalizeFunctions(workspace.functions) }
    } catch {
        return null // corrupted JSON / storage blocked (private browsing, etc.) — start fresh
    }
}

export const saveWorkspace = (workspace: PersistedWorkspace): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
    } catch {
        // quota exceeded / storage blocked — nothing to recover to, just don't autosave
    }
}

export const clearWorkspace = (): void => {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch {
        // ignore
    }
}
