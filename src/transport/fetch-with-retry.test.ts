import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getDefaultDispatcherMock } = vi.hoisted(() => ({
    getDefaultDispatcherMock: vi.fn(() => ({ close: vi.fn() })),
}))

vi.mock('./http-dispatcher.js', () => ({
    getDefaultDispatcher: getDefaultDispatcherMock,
}))

describe('fetchWithRetry', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('retries network failures and eventually succeeds', async () => {
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new TypeError('temporary network failure'))
            .mockResolvedValueOnce(new Response('ok', { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const { fetchWithRetry } = await import('./fetch-with-retry.js')
        const response = await fetchWithRetry({
            url: 'https://example.com',
            retryConfig: { retries: 1 },
        })

        expect(response.status).toBe(200)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(getDefaultDispatcherMock).toHaveBeenCalledTimes(2)
    })

    it('aborts requests when the timeout elapses', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => {
            return new Promise<Response>((_resolve, reject) => {
                const signal = options?.signal
                signal?.addEventListener('abort', () => reject(signal.reason as Error), {
                    once: true,
                })
            })
        })

        vi.stubGlobal('fetch', fetchMock)

        const { fetchWithRetry } = await import('./fetch-with-retry.js')
        const promise = fetchWithRetry({
            url: 'https://example.com',
            options: { timeout: 50 },
        })
        const expectation = expect(promise).rejects.toThrow('Request timeout after 50ms')

        await vi.advanceTimersByTimeAsync(50)

        await expectation
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('respects an existing abort signal', async () => {
        const controller = new AbortController()
        controller.abort(new Error('cancelled'))

        const fetchMock = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => {
            return Promise.reject(options?.signal?.reason as Error)
        })

        vi.stubGlobal('fetch', fetchMock)

        const { fetchWithRetry } = await import('./fetch-with-retry.js')

        await expect(
            fetchWithRetry({
                url: 'https://example.com',
                options: { signal: controller.signal },
            }),
        ).rejects.toThrow('cancelled')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
