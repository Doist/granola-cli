import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PROXY_ENV_KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'] as const

describe('http dispatcher', () => {
    const originalEnv = Object.fromEntries(
        PROXY_ENV_KEYS.map((key) => [key, process.env[key]]),
    ) as Record<(typeof PROXY_ENV_KEYS)[number], string | undefined>

    beforeEach(() => {
        for (const key of PROXY_ENV_KEYS) {
            delete process.env[key]
        }
        vi.resetModules()
    })

    afterEach(async () => {
        for (const key of PROXY_ENV_KEYS) {
            const value = originalEnv[key]
            if (value === undefined) {
                delete process.env[key]
            } else {
                process.env[key] = value
            }
        }
        const module = await import('./http-dispatcher.js')
        await module.resetDefaultDispatcherForTests()
        vi.restoreAllMocks()
    })

    it('uses the default agent when no proxy env is set', async () => {
        const module = await import('./http-dispatcher.js')
        const dispatcher = module.getDefaultDispatcher()
        expect(dispatcher.constructor.name).toBe('Agent')
    })

    it('uses a proxy-aware dispatcher when proxy env is set', async () => {
        process.env.HTTPS_PROXY = 'http://localhost:3128'
        const module = await import('./http-dispatcher.js')
        const dispatcher = module.getDefaultDispatcher()
        expect(dispatcher.constructor.name).toBe('EnvHttpProxyAgent')
    })

    it('clears the cached dispatcher on reset', async () => {
        const module = await import('./http-dispatcher.js')
        const dispatcher = module.getDefaultDispatcher()
        const closeSpy = vi.spyOn(dispatcher, 'close').mockResolvedValue(undefined)

        await module.resetDefaultDispatcherForTests()
        const replacement = module.getDefaultDispatcher()

        expect(closeSpy).toHaveBeenCalledTimes(1)
        expect(replacement).not.toBe(dispatcher)
    })
})
