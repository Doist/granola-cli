import { normalizeFolders, normalizePeople, uniqueStrings } from './cache.js'
import { GranolaError } from './errors.js'
import { compactWhitespace, flattenTranscript } from './transcript.js'
import type {
    FolderSummary,
    GranolaNote,
    IndexedNote,
    MatchedField,
    NoteFolder,
    SearchFilters,
    SearchScore,
} from './types.js'

export function normalizeDateBoundary(value: string, edge: 'start' | 'end'): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        throw new GranolaError('USAGE_ERROR', `Invalid date: ${value}`)
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (edge === 'start') {
            date.setUTCHours(0, 0, 0, 0)
        } else {
            date.setUTCHours(23, 59, 59, 999)
        }
    }

    return date.toISOString()
}

export function validateDateRange(filters: SearchFilters): void {
    if (filters.after && filters.before && filters.after > filters.before) {
        throw new GranolaError('USAGE_ERROR', '--after must be earlier than --before')
    }
}

export function parseLimit(rawLimit: string | number | undefined, fallback = 20): number {
    const value = rawLimit === undefined ? fallback : Number.parseInt(String(rawLimit), 10)
    if (!Number.isFinite(value) || value <= 0) {
        throw new GranolaError('USAGE_ERROR', '--limit must be a positive integer')
    }
    return value
}

export function parseDateValue(value: string | null | undefined): number {
    if (!value) {
        return 0
    }
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
}

export function filterEntries(entries: IndexedNote[], filters: SearchFilters): IndexedNote[] {
    return entries.filter((entry) => {
        if (filters.after && entry.meetingDate && entry.meetingDate < filters.after) {
            return false
        }
        if (filters.before && entry.meetingDate && entry.meetingDate > filters.before) {
            return false
        }

        if (filters.person) {
            const personNeedle = filters.person.toLowerCase()
            const matchesPerson = [
                entry.ownerName,
                entry.ownerEmail,
                ...getEntryPeopleSearch(entry),
            ]
                .filter((value): value is string => Boolean(value))
                .some((value) => value.toLowerCase().includes(personNeedle))
            if (!matchesPerson) {
                return false
            }
        }

        if (filters.folder) {
            const folderNeedle = filters.folder.toLowerCase()
            const matchesFolder = getEntryFolderSearch(entry).some((value) =>
                value.toLowerCase().includes(folderNeedle),
            )
            if (!matchesFolder) {
                return false
            }
        }

        return true
    })
}

export function sortEntriesByDate(entries: IndexedNote[]): IndexedNote[] {
    return [...entries].sort(
        (left, right) =>
            parseDateValue(right.meetingDate || right.createdAt) -
            parseDateValue(left.meetingDate || left.createdAt),
    )
}

export function scoreQuery(note: GranolaNote, query: string): SearchScore {
    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)

    if (terms.length === 0) {
        return { matches: true, score: 0, matchedFields: [], excerpt: null }
    }

    const fields: Array<{
        key: MatchedField['key']
        weight: number
        text: string
        lowerText: string
    }> = [
        buildSearchField('title', 5, note.title || ''),
        buildSearchField('people', 4, [
            note.owner?.name,
            note.owner?.email,
            ...normalizePeople(note.attendees),
            note.calendar_event?.event_title,
            note.calendar_event?.organiser,
            ...normalizePeople(note.calendar_event?.invitees),
        ]),
        buildSearchField(
            'folders',
            2,
            normalizeFolders(note.folder_membership)
                .flatMap((folder) => [folder.name, folder.id])
                .filter(Boolean),
        ),
        buildSearchField('summary', 3, note.summary_markdown || note.summary_text || ''),
        buildSearchField('transcript', 1, flattenTranscript(note.transcript), { normalized: true }),
    ]

    const combined = fields.map((field) => field.lowerText).join('\n')
    const matchedTermsByField = new Map<MatchedField['key'], Set<string>>()
    let score = 0

    for (const term of terms) {
        if (!combined.includes(term)) {
            return { matches: false, score: 0, matchedFields: [], excerpt: null }
        }

        for (const field of fields) {
            if (!field.lowerText.includes(term)) {
                continue
            }
            score += field.weight
            const existing = matchedTermsByField.get(field.key) || new Set<string>()
            existing.add(term)
            matchedTermsByField.set(field.key, existing)
        }
    }

    const matchedFields = fields
        .filter((field) => matchedTermsByField.has(field.key))
        .map((field) => ({
            key: field.key,
            terms: [...(matchedTermsByField.get(field.key) || new Set<string>())],
        }))

    const previewField =
        fields.find(
            (field) =>
                (field.key === 'summary' || field.key === 'transcript') &&
                matchedTermsByField.has(field.key),
        ) || fields.find((field) => field.key === 'title' && matchedTermsByField.has(field.key))

    return {
        matches: true,
        score,
        matchedFields,
        excerpt: previewField ? excerptForTerms(previewField.text, terms) : null,
    }
}

function buildSearchField(
    key: MatchedField['key'],
    weight: number,
    value: string | Array<string | null | undefined>,
    options: { normalized?: boolean } = {},
): { key: MatchedField['key']; weight: number; text: string; lowerText: string } {
    const rawText = Array.isArray(value) ? value.filter(Boolean).join(' ') : value
    const text = options.normalized ? rawText : compactWhitespace(rawText)
    return {
        key,
        weight,
        text,
        lowerText: text.toLowerCase(),
    }
}

export function collectFolderResults(entries: IndexedNote[]): FolderSummary[] {
    const folders = new Map<string, FolderSummary>()

    for (const entry of entries) {
        for (const folder of getEntryFolders(entry)) {
            const key = folder.id || (folder.name ? `name:${folder.name}` : null)
            if (!key) {
                continue
            }

            const existing = folders.get(key) || {
                id: folder.id || null,
                name: folder.name || '(unnamed folder)',
                noteCount: 0,
                latestMeetingDate: null,
            }

            existing.noteCount += 1
            const currentDate = entry.meetingDate || entry.createdAt || null
            if (
                !existing.latestMeetingDate ||
                parseDateValue(currentDate) > parseDateValue(existing.latestMeetingDate)
            ) {
                existing.latestMeetingDate = currentDate
            }

            folders.set(key, existing)
        }
    }

    return [...folders.values()].sort((left, right) => {
        if (right.noteCount !== left.noteCount) {
            return right.noteCount - left.noteCount
        }

        const rightDate = parseDateValue(right.latestMeetingDate)
        const leftDate = parseDateValue(left.latestMeetingDate)
        if (rightDate !== leftDate) {
            return rightDate - leftDate
        }

        return left.name.localeCompare(right.name)
    })
}

export function getEntryPeopleNames(entry: IndexedNote): string[] {
    return entry.peopleNames || []
}

export function getEntryPeopleSearch(entry: IndexedNote): string[] {
    return entry.peopleSearch || []
}

export function getEntryFolders(entry: IndexedNote): NoteFolder[] {
    return Array.isArray(entry.folders) ? entry.folders : []
}

export function getEntryFolderNames(entry: IndexedNote): string[] {
    return uniqueStrings(getEntryFolders(entry).map((folder) => folder.name))
}

export function getEntryFolderSearch(entry: IndexedNote): string[] {
    return uniqueStrings(getEntryFolders(entry).flatMap((folder) => [folder.name, folder.id]))
}

function excerptForTerms(text: string, terms: string[], maxLength = 160): string | null {
    const normalized = compactWhitespace(text)
    if (!normalized) {
        return null
    }

    if (normalized.length <= maxLength) {
        return normalized
    }

    const lower = normalized.toLowerCase()
    const firstIndex = terms
        .map((term) => lower.indexOf(term))
        .filter((index) => index >= 0)
        .sort((left, right) => left - right)[0]

    if (firstIndex === undefined) {
        return `${normalized.slice(0, maxLength - 1)}…`
    }

    const start = Math.max(0, firstIndex - 40)
    const end = Math.min(normalized.length, start + maxLength)
    const prefix = start > 0 ? '…' : ''
    const suffix = end < normalized.length ? '…' : ''
    return `${prefix}${normalized.slice(start, end)}${suffix}`
}
