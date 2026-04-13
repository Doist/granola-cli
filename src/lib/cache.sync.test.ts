import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('cache filesystem behavior', () => {
    const originalHome = process.env.HOME
    let tempHome: string

    beforeEach(() => {
        tempHome = mkdtempSync(join(tmpdir(), 'granola-cache-'))
        process.env.HOME = tempHome
        vi.resetModules()
    })

    afterEach(() => {
        vi.resetModules()
        rmSync(tempHome, { recursive: true, force: true })
        if (originalHome === undefined) {
            delete process.env.HOME
        } else {
            process.env.HOME = originalHome
        }
    })

    it('does not advance sync timestamps when note fetches fail', async () => {
        const cache = await import('./cache.js')
        const client = {
            listNotes: vi.fn().mockResolvedValue({
                notes: [{ id: 'not_1', updated_at: '2026-04-07T11:00:00Z' }],
                hasMore: false,
                cursor: null,
            }),
            getNote: vi.fn().mockRejectedValue(new Error('boom')),
        }

        const result = await cache.syncGranolaCache(client as never, { full: true })
        const state = cache.loadState()

        expect(result.failed).toBe(1)
        expect(result.lastSyncAt).toBeNull()
        expect(result.lastFullSyncAt).toBeNull()
        expect(state.lastSyncAt).toBeNull()
        expect(state.lastFullSyncAt).toBeNull()
    })

    it('writes cache directories and files with restrictive permissions', async () => {
        const cache = await import('./cache.js')
        cache.saveState(cache.defaultState())
        cache.writeCachedNote({
            id: 'not_1',
            title: 'Leadership Sync',
            created_at: '2026-04-07T10:00:00Z',
        })

        expect(mode(cache.CACHE_DIR)).toBe(0o700)
        expect(mode(cache.NOTES_DIR)).toBe(0o700)
        expect(mode(cache.STATE_FILE)).toBe(0o600)
        expect(mode(cache.noteCachePath('not_1'))).toBe(0o600)
    })
})

function mode(path: string): number {
    return statSync(path).mode & 0o777
}
