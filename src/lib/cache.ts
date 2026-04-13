import {
    chmodSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join, relative } from 'node:path'
import { GranolaApiClient } from './api.js'
import { compactWhitespace } from './transcript.js'
import type {
    CacheState,
    CachedNoteRecord,
    GranolaFolderMembership,
    GranolaNote,
    GranolaPerson,
    IndexedNote,
    NoteFolder,
    SyncResult,
} from './types.js'

export const CACHE_DIR = join(homedir(), '.cache', 'granola-cli')
export const NOTES_DIR = join(CACHE_DIR, 'notes')
export const STATE_FILE = join(CACHE_DIR, 'state.json')
export const CACHE_SCHEMA_VERSION = 1
export const FULL_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
const SYNC_LOOKBACK_MS = 5 * 60 * 1000
const MAX_PAGE_SIZE = 30
const PREVIEW_LENGTH = 180
let cacheDirsEnsured = false

export function defaultState(): CacheState {
    return {
        schemaVersion: CACHE_SCHEMA_VERSION,
        lastSyncAt: null,
        lastFullSyncAt: null,
        notes: {},
    }
}

export function ensureCacheDirs(): void {
    if (cacheDirsEnsured) {
        return
    }

    mkdirSync(NOTES_DIR, { recursive: true, mode: 0o700 })
    chmodSync(CACHE_DIR, 0o700)
    chmodSync(NOTES_DIR, 0o700)
    cacheDirsEnsured = true
}

export function loadState(): CacheState {
    try {
        const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as CacheState
        if (
            !parsed ||
            parsed.schemaVersion !== CACHE_SCHEMA_VERSION ||
            typeof parsed.notes !== 'object' ||
            parsed.notes === null
        ) {
            return defaultState()
        }

        return {
            schemaVersion: CACHE_SCHEMA_VERSION,
            lastSyncAt: parsed.lastSyncAt ?? null,
            lastFullSyncAt: parsed.lastFullSyncAt ?? null,
            notes: parsed.notes ?? {},
        }
    } catch {
        return defaultState()
    }
}

export function saveState(state: CacheState): void {
    ensureCacheDirs()
    writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
    })
    chmodSync(STATE_FILE, 0o600)
}

export function noteCachePath(noteId: string): string {
    return join(NOTES_DIR, `${noteId}.json`)
}

export function readCachedNote(noteId: string): CachedNoteRecord | null {
    const filePath = noteCachePath(noteId)
    if (!existsSync(filePath)) {
        return null
    }

    try {
        return JSON.parse(readFileSync(filePath, 'utf8')) as CachedNoteRecord
    } catch {
        return null
    }
}

export function writeCachedNote(note: GranolaNote): void {
    ensureCacheDirs()
    const record: CachedNoteRecord = {
        schemaVersion: CACHE_SCHEMA_VERSION,
        cachedAt: new Date().toISOString(),
        note,
    }
    const filePath = noteCachePath(note.id)
    writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
    })
    chmodSync(filePath, 0o600)
}

export function removeCachedNote(noteId: string): void {
    rmSync(noteCachePath(noteId), { force: true })
}

export async function syncGranolaCache(
    client: GranolaApiClient,
    options: { full?: boolean } = {},
): Promise<SyncResult> {
    ensureCacheDirs()

    const state = loadState()
    const shouldFullSync =
        options.full ||
        !state.lastSyncAt ||
        needsFullSync(state) ||
        Object.keys(state.notes).length === 0

    const syncStartedAt = new Date().toISOString()
    const seenIds = shouldFullSync ? new Set<string>() : null
    const listedNotes = new Map<string, { id: string; updated_at?: string | null }>()
    const listParams: Record<string, string | number | null | undefined> = {
        page_size: MAX_PAGE_SIZE,
    }

    if (!shouldFullSync && state.lastSyncAt) {
        const syncedAtMs = Date.parse(state.lastSyncAt)
        const lookbackMs = Number.isNaN(syncedAtMs)
            ? Date.now() - SYNC_LOOKBACK_MS
            : syncedAtMs - SYNC_LOOKBACK_MS
        listParams.updated_after = new Date(lookbackMs).toISOString()
    }

    let cursor: string | null | undefined = null
    do {
        const response = await client.listNotes({ ...listParams, cursor })
        const notes = Array.isArray(response.notes) ? response.notes : []
        for (const note of notes) {
            listedNotes.set(note.id, note)
            if (seenIds) {
                seenIds.add(note.id)
            }
        }
        cursor = response.hasMore ? response.cursor : null
    } while (cursor)

    const notesToFetch = [...listedNotes.values()].filter((note) => {
        const existing = state.notes[note.id]
        return (
            !existing ||
            existing.updatedAt !== (note.updated_at ?? null) ||
            !existsSync(noteCachePath(note.id))
        )
    })

    const failures: Array<{ noteId: string; message: string }> = []
    let fetched = 0

    for (const note of notesToFetch) {
        try {
            const detailedNote = await client.getNote(note.id)
            writeCachedNote(detailedNote)
            state.notes[detailedNote.id] = summarizeNoteForState(detailedNote)
            fetched += 1
        } catch (error) {
            failures.push({
                noteId: note.id,
                message: error instanceof Error ? error.message : String(error),
            })
        }
    }

    let removed = 0
    if (seenIds) {
        for (const noteId of Object.keys(state.notes)) {
            if (seenIds.has(noteId)) {
                continue
            }
            delete state.notes[noteId]
            removeCachedNote(noteId)
            removed += 1
        }
    }

    if (failures.length === 0) {
        state.lastSyncAt = syncStartedAt
        if (shouldFullSync) {
            state.lastFullSyncAt = syncStartedAt
        }
    }
    saveState(state)

    return {
        mode: shouldFullSync ? 'full' : 'incremental',
        listed: listedNotes.size,
        fetched,
        failed: failures.length,
        failures,
        removed,
        totalCached: Object.keys(state.notes).length,
        lastSyncAt: state.lastSyncAt,
        lastFullSyncAt: state.lastFullSyncAt,
    }
}

export function summarizeNoteForState(note: GranolaNote): IndexedNote {
    const peopleNames = uniqueStrings([
        note.owner?.name,
        ...normalizePeople(note.attendees, { namesOnly: true }),
        ...normalizePeople(note.calendar_event?.invitees, { namesOnly: true }),
    ])

    const peopleSearch = uniqueStrings([
        note.owner?.name,
        note.owner?.email,
        ...normalizePeople(note.attendees),
        note.calendar_event?.organiser,
        ...normalizePeople(note.calendar_event?.invitees),
    ])

    return {
        id: note.id,
        title: note.title || '(untitled)',
        createdAt: note.created_at ?? null,
        updatedAt: note.updated_at ?? null,
        meetingDate: note.calendar_event?.scheduled_start_time ?? note.created_at ?? null,
        ownerName: note.owner?.name ?? null,
        ownerEmail: note.owner?.email ?? null,
        peopleNames,
        peopleSearch,
        folders: normalizeFolders(note.folder_membership),
        preview: buildPreview(note),
        file: relative(CACHE_DIR, noteCachePath(note.id)),
    }
}

export function buildPreview(note: GranolaNote): string {
    const summary = compactWhitespace(note.summary_markdown || note.summary_text || '')
    if (summary) {
        return summary.slice(0, PREVIEW_LENGTH)
    }

    return transcriptPreview(note.transcript, PREVIEW_LENGTH)
}

function transcriptPreview(transcript: unknown, maxLength: number): string {
    let preview = ''

    appendPreviewText(transcript, (value) => {
        preview = appendNormalizedChunk(preview, value, maxLength)
        return preview.length < maxLength
    })

    return preview
}

function appendPreviewText(value: unknown, append: (text: string) => boolean): boolean {
    if (value === null || value === undefined) {
        return true
    }

    if (typeof value === 'string') {
        const normalized = compactWhitespace(value)
        return !normalized || append(normalized)
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            if (!appendPreviewText(item, append)) {
                return false
            }
        }
        return true
    }

    if (typeof value === 'object') {
        for (const item of Object.values(value)) {
            if (!appendPreviewText(item, append)) {
                return false
            }
        }
    }

    return true
}

function appendNormalizedChunk(current: string, chunk: string, maxLength: number): string {
    if (!chunk || current.length >= maxLength) {
        return current
    }

    const combined = current ? `${current} ${chunk}` : chunk
    return compactWhitespace(combined).slice(0, maxLength)
}

export function normalizePeople(
    items: Array<GranolaPerson | string> | null | undefined,
    options: { namesOnly?: boolean } = {},
): string[] {
    if (!Array.isArray(items)) {
        return []
    }

    const namesOnly = Boolean(options.namesOnly)

    return uniqueStrings(
        items.flatMap((item) => {
            if (typeof item === 'string') {
                if (namesOnly && isLikelyEmail(item)) {
                    return []
                }
                return [item]
            }
            if (!item || typeof item !== 'object') {
                return []
            }
            return namesOnly ? [item.name] : [item.name, item.email]
        }),
    )
}

export function normalizeFolders(
    items: GranolaFolderMembership[] | null | undefined,
): NoteFolder[] {
    if (!Array.isArray(items)) {
        return []
    }

    const seen = new Set<string>()
    const folders: NoteFolder[] = []

    for (const item of items) {
        if (!item || typeof item !== 'object') {
            continue
        }

        const id = item.id ? String(item.id).trim() : null
        const name = item.name ? String(item.name).trim() : null
        const key = id || (name ? `name:${name}` : null)
        if (!key || seen.has(key)) {
            continue
        }

        seen.add(key)
        folders.push({ id, name })
    }

    return folders
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
    return [
        ...new Set(
            values
                .filter(Boolean)
                .map((value) => String(value).trim())
                .filter(Boolean),
        ),
    ]
}

export function countCachedNotes(): number {
    const state = loadState()
    return Object.keys(state.notes).length
}

export function listCachedNoteIds(): string[] {
    if (!existsSync(NOTES_DIR)) {
        return []
    }

    return readdirSync(NOTES_DIR)
        .filter((fileName) => fileName.endsWith('.json'))
        .map((fileName) => fileName.slice(0, -'.json'.length))
}

function needsFullSync(state: CacheState): boolean {
    if (!state.lastFullSyncAt) {
        return true
    }

    const lastFullSyncMs = Date.parse(state.lastFullSyncAt)
    if (Number.isNaN(lastFullSyncMs)) {
        return true
    }

    return Date.now() - lastFullSyncMs >= FULL_SYNC_INTERVAL_MS
}

function isLikelyEmail(value: string): boolean {
    return value.includes('@')
}
