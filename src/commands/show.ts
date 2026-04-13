import type { Command } from 'commander'
import { readCachedNote, summarizeNoteForState } from '../lib/cache.js'
import { GranolaError } from '../lib/errors.js'
import { formatLocalDate, formatSyncBanner } from '../lib/output.js'
import { formatError } from '../lib/output.js'
import { formatTranscript } from '../lib/transcript.js'
import type { GranolaNote, SyncResult } from '../lib/types.js'
import { maybeSyncCache } from './runtime.js'
import { addShowOptions, parseShowOptions } from './shared.js'

export function registerShowCommand(program: Command): void {
    addShowOptions(program.command('show <noteId>').description('Show a cached note')).action(
        async (noteId: string, rawOptions: Record<string, unknown>) => {
            const options = parseShowOptions(rawOptions)

            try {
                const sync = await maybeSyncCache(options.noSync)
                const cached = readCachedNote(noteId)
                if (!cached?.note) {
                    throw new GranolaError(
                        'NOT_FOUND',
                        `No cached note found for ${noteId}. Run \`granola sync --full\` if this note should exist.`,
                    )
                }

                const note = buildShowNote(cached.note, options.transcript)

                if (options.output.json) {
                    console.log(
                        JSON.stringify(
                            {
                                sync,
                                note: options.output.full ? cached.note : note,
                            },
                            null,
                            2,
                        ),
                    )
                    return
                }

                console.log(formatShowResult(note, sync, options.transcript))
            } catch (error) {
                const code = error instanceof GranolaError ? error.code : 'SHOW_FAILED'
                const message = error instanceof Error ? error.message : String(error)
                console.error(
                    formatError(code, message, [
                        'Use `granola list` or `granola search` to find available note IDs',
                        'Run `granola show <note-id> --no-sync` to inspect the local cache only',
                    ]),
                )
                process.exit(1)
            }
        },
    )
}

function buildShowNote(note: GranolaNote, includeTranscript: boolean): Record<string, unknown> {
    const summary = summarizeNoteForState(note)

    return {
        id: summary.id,
        title: summary.title,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        meetingDate: summary.meetingDate,
        owner: note.owner ?? null,
        peopleNames: summary.peopleNames,
        attendees: note.attendees ?? [],
        folders: summary.folders,
        calendarEvent: note.calendar_event ?? null,
        summaryText: note.summary_text ?? null,
        summaryMarkdown: note.summary_markdown ?? null,
        transcript: includeTranscript ? (note.transcript ?? null) : null,
    }
}

function formatShowResult(
    note: Record<string, unknown>,
    sync: SyncResult | null,
    includeTranscript: boolean,
): string {
    const lines: string[] = []
    const banner = formatSyncBanner(sync)
    if (banner) {
        lines.push(banner, '')
    }

    lines.push(String(note.title))
    lines.push(
        `Date: ${formatLocalDate(note.meetingDate as string | null | undefined, { withTime: true })}`,
    )
    lines.push(`ID: ${note.id}`)

    const owner = note.owner as { name?: string | null; email?: string | null } | null
    if (owner?.name || owner?.email) {
        const ownerBits = [owner.name, owner.email ? `<${owner.email}>` : null].filter(Boolean)
        lines.push(`Owner: ${ownerBits.join(' ')}`)
    }

    const attendees = Array.isArray(note.attendees) ? note.attendees : []
    if (attendees.length > 0) {
        const attendeeSummary = attendees
            .map((attendee) => {
                if (typeof attendee === 'string') {
                    return attendee
                }
                if (!attendee || typeof attendee !== 'object') {
                    return null
                }
                const record = attendee as { name?: string | null; email?: string | null }
                return [record.name, record.email ? `<${record.email}>` : null]
                    .filter(Boolean)
                    .join(' ')
            })
            .filter(Boolean)
            .join(', ')
        if (attendeeSummary) {
            lines.push(`Attendees: ${attendeeSummary}`)
        }
    }

    const folders = Array.isArray(note.folders) ? note.folders : []
    if (folders.length > 0) {
        const folderSummary = folders
            .map((folder) => {
                if (!folder || typeof folder !== 'object') {
                    return null
                }
                const record = folder as { name?: string | null; id?: string | null }
                return record.name || record.id || null
            })
            .filter(Boolean)
            .join(', ')
        if (folderSummary) {
            lines.push(`Folders: ${folderSummary}`)
        }
    }

    const calendarEvent = note.calendarEvent as { event_title?: string | null } | null
    if (calendarEvent?.event_title) {
        lines.push(`Event: ${calendarEvent.event_title}`)
    }

    if (typeof note.summaryMarkdown === 'string' && note.summaryMarkdown.trim()) {
        lines.push('', 'Summary:', note.summaryMarkdown)
    } else if (typeof note.summaryText === 'string' && note.summaryText.trim()) {
        lines.push('', 'Summary:', note.summaryText)
    }

    if (includeTranscript && note.transcript !== null && note.transcript !== undefined) {
        const transcript = formatTranscript(note.transcript)
        if (transcript) {
            lines.push('', 'Transcript:', transcript)
        }
    }

    return lines.join('\n')
}
