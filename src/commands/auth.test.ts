import { EventEmitter } from 'node:events'
import { Command } from 'commander'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GranolaError } from '../lib/errors.js'

const {
    clearApiKeyMock,
    granolaApiClientMock,
    loadStateMock,
    resolveApiKeyMock,
    saveApiKeyMock,
    validateApiKeyMock,
    withSpinnerMock,
} = vi.hoisted(() => ({
    validateApiKeyMock: vi.fn(),
    granolaApiClientMock: vi.fn(),
    saveApiKeyMock: vi.fn(),
    clearApiKeyMock: vi.fn(),
    resolveApiKeyMock: vi.fn(),
    loadStateMock: vi.fn(),
    withSpinnerMock: vi.fn(),
}))

vi.mock('../lib/api.js', () => ({
    GranolaApiClient: granolaApiClientMock,
    getApiBaseUrl: vi.fn(() => 'https://api.granola.test'),
}))

vi.mock('../lib/auth.js', () => ({
    clearApiKey: clearApiKeyMock,
    CONFIG_PATH: '/tmp/granola/config.json',
    resolveApiKey: resolveApiKeyMock,
    saveApiKey: saveApiKeyMock,
}))

vi.mock('../lib/cache.js', () => ({
    CACHE_DIR: '/tmp/granola/cache',
    loadState: loadStateMock,
}))

vi.mock('../lib/spinner.js', () => ({
    withSpinner: withSpinnerMock,
}))

describe('auth command', () => {
    let logs: string[]
    let errors: string[]
    const originalEnvToken = process.env.GRANOLA_API_KEY

    beforeEach(() => {
        logs = []
        errors = []
        vi.clearAllMocks()

        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logs.push(args.join(' '))
        })
        vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            errors.push(args.join(' '))
        })

        granolaApiClientMock.mockImplementation(function () {
            return {
                validateApiKey: validateApiKeyMock,
            }
        })
        validateApiKeyMock.mockResolvedValue(undefined)
        saveApiKeyMock.mockResolvedValue({ storage: 'secure-store' })
        clearApiKeyMock.mockResolvedValue({
            clearedSecureStore: true,
            clearedConfigFile: true,
        })
        resolveApiKeyMock.mockResolvedValue({ token: null, source: 'none' })
        loadStateMock.mockReturnValue({
            schemaVersion: 1,
            lastSyncAt: null,
            lastFullSyncAt: null,
            notes: {},
        })
        withSpinnerMock.mockImplementation(async (_options, operation) => operation())
        delete process.env.GRANOLA_API_KEY
    })

    afterEach(() => {
        vi.restoreAllMocks()
        if (originalEnvToken === undefined) {
            delete process.env.GRANOLA_API_KEY
        } else {
            process.env.GRANOLA_API_KEY = originalEnvToken
        }
    })

    it('masks typed API keys', async () => {
        const { readMaskedLine } = await import('./auth.js')
        const input = new EventEmitter() as EventEmitter & {
            isTTY: boolean
            resume: () => void
            pause: () => void
            setRawMode: (mode: boolean) => void
        }
        const writes: string[] = []

        input.isTTY = true
        input.resume = vi.fn()
        input.pause = vi.fn()
        input.setRawMode = vi.fn()

        const promise = readMaskedLine(input, {
            isTTY: true,
            write(chunk: string) {
                writes.push(chunk)
                return true
            },
        })

        for (const character of 'secret-token') {
            input.emit('keypress', character, { name: character, sequence: character })
        }
        input.emit('keypress', '\r', { name: 'enter', sequence: '\r' })

        await expect(promise).resolves.toBe('secret-token')
        expect(writes.join('')).toBe('Granola API key: ************\n')
        expect(writes.join('')).not.toContain('secret-token')
        expect(input.setRawMode).toHaveBeenNthCalledWith(1, true)
        expect(input.setRawMode).toHaveBeenNthCalledWith(2, false)
    })

    it('classifies auth failures by error code', async () => {
        process.env.GRANOLA_API_KEY = 'bad-token'
        resolveApiKeyMock.mockResolvedValue({ token: 'bad-token', source: 'env' })
        validateApiKeyMock.mockRejectedValue(new GranolaError('AUTH_ERROR', 'Access denied'))

        const { registerAuthCommand } = await import('./auth.js')
        const program = new Command()
        program.exitOverride()
        registerAuthCommand(program)

        await program.parseAsync(['node', 'granola', 'auth', 'status'])

        expect(logs.join('\n')).toContain(
            'Access denied. Personal API keys require a Granola Business or Enterprise workspace.',
        )
        expect(errors).toEqual([])
    })

    it('validates the login token once and warns about env overrides', async () => {
        process.env.GRANOLA_API_KEY = 'env-token'

        const { registerAuthCommand } = await import('./auth.js')
        const program = new Command()
        program.exitOverride()
        registerAuthCommand(program)

        await program.parseAsync(['node', 'granola', 'auth', 'login', '--token', 'cli-token'])

        expect(granolaApiClientMock).toHaveBeenCalledTimes(1)
        expect(granolaApiClientMock).toHaveBeenCalledWith('cli-token')
        expect(validateApiKeyMock).toHaveBeenCalledTimes(1)
        expect(saveApiKeyMock).toHaveBeenCalledWith('cli-token')
        expect(logs.join('\n')).toContain(
            'GRANOLA_API_KEY in your environment overrides stored auth until you unset it.',
        )
    })
})
