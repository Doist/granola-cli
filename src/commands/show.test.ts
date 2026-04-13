import { Command } from 'commander'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./runtime.js', () => ({
    maybeSyncCache: vi.fn().mockResolvedValue(null),
}))

vi.mock('../lib/cache.js', () => ({
    readCachedNote: vi.fn(),
    summarizeNoteForState: vi.fn((note) => ({
        id: note.id,
        title: note.title || '(untitled)',
        createdAt: note.created_at ?? null,
        updatedAt: note.updated_at ?? null,
        meetingDate: note.calendar_event?.scheduled_start_time ?? note.created_at ?? null,
        ownerName: note.owner?.name ?? null,
        ownerEmail: note.owner?.email ?? null,
        peopleNames: [note.owner?.name].filter(Boolean),
        peopleSearch: [],
        folders: note.folder_membership || [],
        preview: '',
        file: `notes/${note.id}.json`,
    })),
}))

describe('show command', () => {
    let logs: string[]
    let errors: string[]

    beforeEach(() => {
        logs = []
        errors = []
        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logs.push(args.join(' '))
        })
        vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            errors.push(args.join(' '))
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('renders transcript output', async () => {
        const cache = await import('../lib/cache.js')
        vi.mocked(cache.readCachedNote).mockReturnValue({
            schemaVersion: 1,
            cachedAt: '2026-04-07T11:00:00Z',
            note: {
                id: 'not_1',
                title: 'Roadmap Review',
                owner: { name: 'Goncalo', email: 'goncalo@doist.com' },
                created_at: '2026-04-07T10:00:00Z',
                attendees: [{ name: 'Alice', email: 'alice@example.com' }],
                folder_membership: [{ id: 'fol_1', name: 'Leadership' }],
                calendar_event: {
                    event_title: 'Roadmap Review',
                    scheduled_start_time: '2026-04-07T09:00:00Z',
                },
                summary_markdown: 'Discussed **roadmap** changes.',
                transcript: [
                    {
                        start_timestamp: '2026-04-07T09:00:00Z',
                        speaker_name: 'Alice',
                        text: 'We should ship it.',
                    },
                ],
            },
        })

        const { registerShowCommand } = await import('./show.js')
        const program = new Command()
        program.exitOverride()
        registerShowCommand(program)

        await program.parseAsync(['node', 'granola', 'show', 'not_1', '--transcript'])

        expect(logs.join('\n')).toContain('Roadmap Review')
        expect(logs.join('\n')).toContain('Transcript:')
        expect(logs.join('\n')).toContain('Alice')
    })

    it('fails when note is missing', async () => {
        const cache = await import('../lib/cache.js')
        vi.mocked(cache.readCachedNote).mockReturnValue(null)
        const mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit(${code})`)
        })

        const { registerShowCommand } = await import('./show.js')
        const program = new Command()
        program.exitOverride()
        registerShowCommand(program)

        await expect(program.parseAsync(['node', 'granola', 'show', 'missing'])).rejects.toThrow(
            'process.exit(1)',
        )
        expect(errors.join('\n')).toContain('NOT_FOUND')
        mockExit.mockRestore()
    })
})
