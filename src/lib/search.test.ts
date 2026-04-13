import { describe, expect, it } from 'vitest'
import {
    collectFolderResults,
    filterEntries,
    normalizeDateBoundary,
    parseLimit,
    scoreQuery,
} from './search.js'
import type { IndexedNote } from './types.js'

const NOTES: IndexedNote[] = [
    {
        id: 'not_1',
        title: 'Roadmap Review',
        createdAt: '2026-04-07T10:00:00Z',
        updatedAt: '2026-04-07T11:00:00Z',
        meetingDate: '2026-04-07T09:00:00Z',
        ownerName: 'Goncalo',
        ownerEmail: 'goncalo@doist.com',
        peopleNames: ['Goncalo', 'Alice'],
        peopleSearch: ['Goncalo', 'goncalo@doist.com', 'Alice', 'alice@example.com'],
        folders: [{ id: 'fol_1', name: 'Leadership' }],
        preview: 'Discussed roadmap changes.',
        file: 'notes/not_1.json',
    },
    {
        id: 'not_2',
        title: 'Hiring Sync',
        createdAt: '2026-04-01T10:00:00Z',
        updatedAt: '2026-04-01T11:00:00Z',
        meetingDate: '2026-04-01T09:00:00Z',
        ownerName: 'Goncalo',
        ownerEmail: 'goncalo@doist.com',
        peopleNames: ['Goncalo', 'Bob'],
        peopleSearch: ['Goncalo', 'goncalo@doist.com', 'Bob', 'bob@example.com'],
        folders: [{ id: 'fol_2', name: '1:1' }],
        preview: 'Discussed hiring changes.',
        file: 'notes/not_2.json',
    },
]

describe('search helpers', () => {
    it('normalizes date-only filters to local day boundaries', () => {
        expect(normalizeDateBoundary('2026-04-01', 'start')).toBe(
            new Date(2026, 3, 1, 0, 0, 0, 0).toISOString(),
        )
        expect(normalizeDateBoundary('2026-04-01', 'end')).toBe(
            new Date(2026, 3, 1, 23, 59, 59, 999).toISOString(),
        )
    })

    it('filters entries by person, folder, and date', () => {
        const filtered = filterEntries(NOTES, {
            person: 'alice',
            folder: 'leader',
            after: normalizeDateBoundary('2026-04-01', 'start'),
            before: normalizeDateBoundary('2026-04-30', 'end'),
        })

        expect(filtered.map((entry) => entry.id)).toEqual(['not_1'])
    })

    it('scores query matches and reports fields', () => {
        const score = scoreQuery(
            {
                id: 'not_1',
                title: 'Roadmap Review',
                owner: { name: 'Goncalo', email: 'goncalo@doist.com' },
                created_at: '2026-04-07T10:00:00Z',
                updated_at: '2026-04-07T11:00:00Z',
                attendees: [{ name: 'Alice', email: 'alice@example.com' }],
                folder_membership: [{ id: 'fol_1', name: 'Leadership' }],
                summary_markdown: 'Discussed roadmap shifts.',
                transcript: [{ text: 'Alice covered the roadmap.' }],
            },
            'roadmap alice',
        )

        expect(score.matches).toBe(true)
        expect(score.score).toBeGreaterThan(0)
        expect(score.matchedFields.map((field) => field.key)).toContain('people')
        expect(score.excerpt).toContain('roadmap')
    })

    it('aggregates folders from filtered notes', () => {
        expect(collectFolderResults(NOTES)).toEqual([
            {
                id: 'fol_1',
                name: 'Leadership',
                noteCount: 1,
                latestMeetingDate: '2026-04-07T09:00:00Z',
            },
            {
                id: 'fol_2',
                name: '1:1',
                noteCount: 1,
                latestMeetingDate: '2026-04-01T09:00:00Z',
            },
        ])
    })

    it('parses positive limits', () => {
        expect(parseLimit('5')).toBe(5)
    })
})
