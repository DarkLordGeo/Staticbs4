// Autosaves the workspace (URL + built functions) to localStorage, so
// picking elements survives a refresh. Deliberately excludes the fetched
// page's raw HTML (siteValue) — that can be multiple MB for a real site, way
// more than worth spending localStorage quota on, and the preview needs a
// live iframe load anyway; a restored session just needs "Get Website
// content" clicked again, which every affected feature already tolerates
// gracefully (Run is disabled, group highlighting no-ops) until then.

import type { FnGroup } from '../types/builder'

const STORAGE_KEY = 'visualbs4scraper:workspace'

export type PersistedWorkspace = { url: string; functions: FnGroup[] }

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
        return parsed as PersistedWorkspace
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
