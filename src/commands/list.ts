import type { Command } from 'commander'
import { loadState } from '../lib/cache.js'
import { formatLocalDate, formatSyncBanner, summarizeNamesForDisplay } from '../lib/output.js'
import { formatError } from '../lib/output.js'
import {
    filterEntries,
    getEntryFolderNames,
    getEntryPeopleNames,
    sortEntriesByDate,
} from '../lib/search.js'
import type { IndexedNote, SyncResult } from '../lib/types.js'
import { maybeSyncCache } from './runtime.js'
import { addListQueryOptions, parseListOptions } from './shared.js'

export function registerListCommand(program: Command): void {
    addListQueryOptions(program.command('list').description('List cached notes')).action(
        async (rawOptions: Record<string, unknown>) => {
            const options = parseListOptions(rawOptions)

            try {
                const sync = await maybeSyncCache(options.noSync)
                const state = loadState()
                const notes = sortEntriesByDate(
                    filterEntries(Object.values(state.notes), options),
                ).slice(0, options.limit)

                if (options.output.ndjson) {
                    for (const note of notes) {
                        console.log(JSON.stringify(toListJson(note, options.output.full)))
                    }
                    return
                }

                if (options.output.json) {
                    console.log(
                        JSON.stringify(
                            {
                                sync,
                                notes: notes.map((note) => toListJson(note, options.output.full)),
                            },
                            null,
                            2,
                        ),
                    )
                    return
                }

                console.log(formatListResult(notes, sync))
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                console.error(
                    formatError('LIST_FAILED', message, [
                        'Run `granola auth status` to verify credentials',
                        'Use `granola list --no-sync` to inspect the local cache only',
                    ]),
                )
                process.exit(1)
            }
        },
    )
}

function formatListResult(notes: IndexedNote[], sync: SyncResult | null): string {
    const lines: string[] = []
    const banner = formatSyncBanner(sync)
    if (banner) {
        lines.push(banner, '')
    }

    if (notes.length === 0) {
        lines.push('No notes matched.')
        return lines.join('\n')
    }

    lines.push(`Granola notes (${notes.length})`)
    for (const note of notes) {
        const people = summarizeNamesForDisplay(getEntryPeopleNames(note))
        const folders = summarizeNamesForDisplay(getEntryFolderNames(note), 2)
        lines.push(`${formatLocalDate(note.meetingDate || note.createdAt)} · ${note.title}`)
        if (people) {
            lines.push(`  people: ${people}`)
        }
        if (folders) {
            lines.push(`  folders: ${folders}`)
        }
        lines.push(`  id: ${note.id}`)
    }

    return lines.join('\n')
}

function toListJson(note: IndexedNote, full = false): object {
    if (full) {
        return note
    }

    return {
        id: note.id,
        title: note.title,
        meetingDate: note.meetingDate,
        createdAt: note.createdAt,
        people: getEntryPeopleNames(note),
        folders: getEntryFolderNames(note),
        preview: note.preview,
    }
}
