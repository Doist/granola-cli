import type { Command } from 'commander'
import { GranolaApiClient } from '../lib/api.js'
import { getRequiredApiKey } from '../lib/auth.js'
import { syncGranolaCache } from '../lib/cache.js'
import { formatError } from '../lib/output.js'
import { withSpinner } from '../lib/spinner.js'
import type { SyncResult } from '../lib/types.js'
import { addSyncOptions, parseSyncOptions } from './shared.js'

export function registerSyncCommand(program: Command): void {
    addSyncOptions(program.command('sync').description('Sync notes into the local cache')).action(
        async (rawOptions: Record<string, unknown>) => {
            const options = parseSyncOptions(rawOptions)

            try {
                const apiKey = await getRequiredApiKey()
                const client = new GranolaApiClient(apiKey)
                const result = await withSpinner(
                    {
                        text: options.full
                            ? 'Running full Granola sync...'
                            : 'Running incremental Granola sync...',
                        color: 'blue',
                    },
                    () => syncGranolaCache(client, { full: options.full }),
                )

                if (options.output.json) {
                    console.log(JSON.stringify(result, null, 2))
                    return
                }

                console.log(formatSyncResult(result))
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                console.error(
                    formatError('SYNC_FAILED', message, [
                        'Run `granola auth status` to verify credentials',
                        'Use `granola sync --full` if the cache looks stale',
                    ]),
                )
                process.exit(1)
            }
        },
    )
}

function formatSyncResult(result: SyncResult): string {
    const lines = [
        `Granola cache sync (${result.mode})`,
        `- listed: ${result.listed}`,
        `- fetched: ${result.fetched}`,
        `- removed: ${result.removed}`,
        `- cached: ${result.totalCached}`,
    ]

    if (result.failed > 0) {
        lines.push(`- failed: ${result.failed}`)
    }

    return lines.join('\n')
}
