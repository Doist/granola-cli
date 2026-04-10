import type { Command } from 'commander'
import { loadState, readCachedNote } from '../lib/cache.js'
import {
    formatLocalDate,
    formatMatchedFields,
    formatSyncBanner,
    summarizeNamesForDisplay,
} from '../lib/output.js'
import { formatError } from '../lib/output.js'
import {
    filterEntries,
    getEntryFolderNames,
    getEntryPeopleNames,
    parseDateValue,
    scoreQuery,
} from '../lib/search.js'
import type { SearchResult, SyncResult } from '../lib/types.js'
import { maybeSyncCache } from './runtime.js'
import { addListQueryOptions, parseListOptions } from './shared.js'

export function registerSearchCommand(program: Command): void {
    addListQueryOptions(
        program.command('search <query>').description('Search cached notes'),
    ).action(async (query: string, rawOptions: Record<string, unknown>) => {
        const options = parseListOptions(rawOptions)
        const normalizedQuery = query.trim()
        if (!normalizedQuery) {
            console.error(formatError('USAGE_ERROR', 'Search requires a query string'))
            process.exit(1)
        }

        try {
            const sync = await maybeSyncCache(options.noSync)
            const state = loadState()
            const candidates = filterEntries(Object.values(state.notes), options)
            const results: SearchResult[] = []

            for (const entry of candidates) {
                const cached = readCachedNote(entry.id)
                if (!cached?.note) {
                    continue
                }
                const score = scoreQuery(cached.note, normalizedQuery)
                if (!score.matches) {
                    continue
                }
                results.push({
                    ...entry,
                    score: score.score,
                    matchedFields: score.matchedFields,
                    excerpt: score.excerpt,
                })
            }

            results.sort((left, right) => {
                if (right.score !== left.score) {
                    return right.score - left.score
                }
                const rightDate = parseDateValue(right.meetingDate || right.createdAt)
                const leftDate = parseDateValue(left.meetingDate || left.createdAt)
                return rightDate - leftDate
            })

            const sliced = results.slice(0, options.limit)

            if (options.output.ndjson) {
                for (const result of sliced) {
                    console.log(JSON.stringify(toSearchJson(result, options.output.full)))
                }
                return
            }

            if (options.output.json) {
                console.log(
                    JSON.stringify(
                        {
                            sync,
                            query: normalizedQuery,
                            results: sliced.map((result) =>
                                toSearchJson(result, options.output.full),
                            ),
                        },
                        null,
                        2,
                    ),
                )
                return
            }

            console.log(formatSearchResult(sliced, sync))
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(
                formatError('SEARCH_FAILED', message, [
                    'Run `granola auth status` to verify credentials',
                    'Use `granola search --no-sync` to search only the local cache',
                ]),
            )
            process.exit(1)
        }
    })
}

function formatSearchResult(results: SearchResult[], sync: SyncResult | null): string {
    const lines: string[] = []
    const banner = formatSyncBanner(sync)
    if (banner) {
        lines.push(banner, '')
    }

    if (results.length === 0) {
        lines.push('No notes matched.')
        return lines.join('\n')
    }

    lines.push(`Granola search results (${results.length})`)
    for (const result of results) {
        const people = summarizeNamesForDisplay(getEntryPeopleNames(result))
        const folders = summarizeNamesForDisplay(getEntryFolderNames(result), 2)
        lines.push(`${formatLocalDate(result.meetingDate || result.createdAt)} · ${result.title}`)
        const matched = formatMatchedFields(result.matchedFields)
        if (matched) {
            lines.push(`  matched: ${matched}`)
        }
        if (people) {
            lines.push(`  people: ${people}`)
        }
        if (folders) {
            lines.push(`  folders: ${folders}`)
        }
        lines.push(`  id: ${result.id}`)
        if (result.excerpt) {
            lines.push(`  snippet: ${result.excerpt}`)
        }
    }

    return lines.join('\n')
}

function toSearchJson(result: SearchResult, full = false): object {
    if (full) {
        return result
    }

    return {
        id: result.id,
        title: result.title,
        meetingDate: result.meetingDate,
        createdAt: result.createdAt,
        people: getEntryPeopleNames(result),
        folders: getEntryFolderNames(result),
        matchedFields: result.matchedFields,
        excerpt: result.excerpt,
        score: result.score,
    }
}
