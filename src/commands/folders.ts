import type { Command } from 'commander'
import { loadState } from '../lib/cache.js'
import { formatLocalDate, formatSyncBanner } from '../lib/output.js'
import { formatError } from '../lib/output.js'
import { collectFolderResults, filterEntries } from '../lib/search.js'
import type { FolderSummary, SyncResult } from '../lib/types.js'
import { maybeSyncCache } from './runtime.js'
import { addListQueryOptions, parseListOptions } from './shared.js'

export function registerFoldersCommand(program: Command): void {
    addListQueryOptions(
        program.command('folders').description('List folders inferred from cached notes'),
        { includeFolder: false },
    ).action(async (rawOptions: Record<string, unknown>) => {
        const options = parseListOptions(rawOptions)

        try {
            const sync = await maybeSyncCache(options.noSync)
            const state = loadState()
            const folders = collectFolderResults(
                filterEntries(Object.values(state.notes), options),
            ).slice(0, options.limit)

            if (options.output.ndjson) {
                for (const folder of folders) {
                    console.log(JSON.stringify(toFolderJson(folder, options.output.full)))
                }
                return
            }

            if (options.output.json) {
                console.log(
                    JSON.stringify(
                        {
                            sync,
                            folders: folders.map((folder) =>
                                toFolderJson(folder, options.output.full),
                            ),
                        },
                        null,
                        2,
                    ),
                )
                return
            }

            console.log(formatFoldersResult(folders, sync))
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(
                formatError('FOLDERS_FAILED', message, [
                    'Run `granola auth status` to verify credentials',
                    'Use `granola folders --no-sync` to inspect the local cache only',
                ]),
            )
            process.exit(1)
        }
    })
}

function formatFoldersResult(folders: FolderSummary[], sync: SyncResult | null): string {
    const lines: string[] = []
    const banner = formatSyncBanner(sync)
    if (banner) {
        lines.push(banner, '')
    }

    if (folders.length === 0) {
        lines.push('No folders found.')
        return lines.join('\n')
    }

    lines.push(`Granola folders (${folders.length})`)
    for (const folder of folders) {
        lines.push(`${folder.name} · ${folder.noteCount} notes`)
        if (folder.latestMeetingDate) {
            lines.push(`  latest: ${formatLocalDate(folder.latestMeetingDate)}`)
        }
        if (folder.id) {
            lines.push(`  id: ${folder.id}`)
        }
    }
    return lines.join('\n')
}

function toFolderJson(folder: FolderSummary, _full = false): object {
    return folder
}
