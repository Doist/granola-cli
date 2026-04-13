import { GranolaApiClient } from '../lib/api.js'
import { getRequiredApiKey } from '../lib/auth.js'
import { syncGranolaCache } from '../lib/cache.js'
import { withSpinner } from '../lib/spinner.js'
import type { SyncResult } from '../lib/types.js'

export async function maybeSyncCache(noSync: boolean): Promise<SyncResult | null> {
    if (noSync) {
        return null
    }

    const apiKey = await getRequiredApiKey()
    const client = new GranolaApiClient(apiKey)
    return withSpinner({ text: 'Refreshing Granola cache...', color: 'blue' }, () =>
        syncGranolaCache(client),
    )
}
