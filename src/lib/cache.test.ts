import { describe, expect, it } from 'vitest'
import { summarizeNoteForState } from './cache.js'

describe('cache summaries', () => {
    it('summarizes folders, people, and preview', () => {
        const summary = summarizeNoteForState({
            id: 'not_123',
            title: 'Leadership Sync',
            owner: { name: 'Goncalo', email: 'goncalo@doist.com' },
            created_at: '2026-04-07T10:00:00Z',
            updated_at: '2026-04-07T11:00:00Z',
            attendees: [{ name: 'Alice', email: 'alice@example.com' }],
            calendar_event: {
                scheduled_start_time: '2026-04-07T09:00:00Z',
                organiser: 'manager@example.com',
                invitees: [{ name: 'Bob', email: 'bob@example.com' }],
                event_title: 'Leadership Sync',
            },
            folder_membership: [{ id: 'fol_1', name: 'Leadership' }],
            summary_markdown: 'Discussed **roadmap** and hiring.',
            transcript: [{ text: 'Fallback transcript' }],
        })

        expect(summary.peopleNames).toEqual(['Goncalo', 'Alice', 'Bob'])
        expect(summary.peopleSearch).toContain('alice@example.com')
        expect(summary.folders).toEqual([{ id: 'fol_1', name: 'Leadership' }])
        expect(summary.preview).toContain('roadmap')
        expect(summary.file).toBe('notes/not_123.json')
    })
})
