import { Command } from 'commander'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./runtime.js', () => ({
    maybeSyncCache: vi.fn().mockResolvedValue(null),
}))

vi.mock('../lib/cache.js', () => ({
    loadState: vi.fn(),
    normalizeFolders: vi.fn((items) => items || []),
    normalizePeople: vi.fn((items) => {
        if (!Array.isArray(items)) {
            return []
        }
        return items.flatMap((item) => {
            if (typeof item === 'string') {
                return [item]
            }
            return [item.name, item.email]
        })
    }),
    readCachedNote: vi.fn(),
    uniqueStrings: vi.fn((values) => [...new Set(values.filter(Boolean))]),
}))

describe('search command', () => {
    let logs: string[]

    beforeEach(() => {
        logs = []
        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logs.push(args.join(' '))
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('outputs JSON search results', async () => {
        const cache = await import('../lib/cache.js')
        vi.mocked(cache.loadState).mockReturnValue({
            schemaVersion: 1,
            lastSyncAt: null,
            lastFullSyncAt: null,
            notes: {
                not_1: {
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
            },
        })
        vi.mocked(cache.readCachedNote).mockReturnValue({
            schemaVersion: 1,
            cachedAt: '2026-04-07T11:00:00Z',
            note: {
                id: 'not_1',
                title: 'Roadmap Review',
                owner: { name: 'Goncalo', email: 'goncalo@doist.com' },
                summary_markdown: 'Discussed roadmap with Alice.',
                attendees: [{ name: 'Alice', email: 'alice@example.com' }],
                folder_membership: [{ id: 'fol_1', name: 'Leadership' }],
                transcript: [{ text: 'Alice reviewed the roadmap.' }],
            },
        })

        const { registerSearchCommand } = await import('./search.js')
        const program = new Command()
        program.exitOverride()
        registerSearchCommand(program)

        await program.parseAsync(['node', 'granola', 'search', 'roadmap', '--json'])

        const parsed = JSON.parse(logs[0])
        expect(parsed.results).toHaveLength(1)
        expect(parsed.results[0].id).toBe('not_1')
        expect(parsed.results[0].matchedFields[0].key).toBeDefined()
    })
})
