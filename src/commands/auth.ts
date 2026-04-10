import { emitKeypressEvents } from 'node:readline'
import chalk from 'chalk'
import type { Command } from 'commander'
import { GranolaApiClient, getApiBaseUrl } from '../lib/api.js'
import { clearApiKey, CONFIG_PATH, resolveApiKey, saveApiKey } from '../lib/auth.js'
import { CACHE_DIR, loadState } from '../lib/cache.js'
import { GranolaError } from '../lib/errors.js'
import { formatError } from '../lib/output.js'
import { withSpinner } from '../lib/spinner.js'
import type { ApiKeySource, AuthStatus } from '../lib/types.js'

interface KeypressInfo {
    name?: string
    sequence?: string
    ctrl?: boolean
    meta?: boolean
}

interface KeypressInput {
    isTTY?: boolean
    setRawMode?: (mode: boolean) => void
    resume: () => void
    pause: () => void
    on: (event: 'keypress', listener: (chunk: string, key?: KeypressInfo) => void) => unknown
    off: (event: 'keypress', listener: (chunk: string, key?: KeypressInfo) => void) => unknown
}

interface KeypressOutput {
    isTTY?: boolean
    write: (chunk: string) => boolean
}

type LoginPayload = AuthStatus & {
    storage: string
    storageWarning: string | null
    envWarning: string | null
}

export function registerAuthCommand(program: Command): void {
    const auth = program.command('auth').description('Manage authentication')

    auth.command('login')
        .description('Authenticate with the Granola API')
        .option('--token <token>', 'Authenticate using a Granola API key')
        .option('--json', 'Output JSON')
        .action(async (options: { token?: string; json?: boolean }) => {
            const envToken = process.env.GRANOLA_API_KEY?.trim() || null
            const token = options.token?.trim() || (await promptForApiKey())
            if (!token) {
                console.error(formatError('AUTH_ERROR', 'Granola API key cannot be empty'))
                process.exit(1)
            }

            try {
                const client = new GranolaApiClient(token)
                await withSpinner({ text: 'Validating Granola API key...', color: 'blue' }, () =>
                    client.validateApiKey(),
                )
                const storage = await saveApiKey(token)
                const payload: LoginPayload = {
                    ...buildAuthStatus(storage.storage, {
                        authenticated: true,
                        notes: 'Granola API key accepted',
                    }),
                    storage: storage.storage,
                    storageWarning: storage.warning || null,
                    envWarning: envToken
                        ? 'GRANOLA_API_KEY in your environment overrides stored auth until you unset it.'
                        : null,
                }

                if (options.json) {
                    console.log(JSON.stringify(payload, null, 2))
                    return
                }

                console.log(formatLoginResult(payload))
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                console.error(
                    formatError('AUTH_LOGIN_FAILED', message, [
                        'Create a personal API key in Granola under Settings → API',
                        'Personal API keys require a Granola Business or Enterprise workspace',
                    ]),
                )
                process.exit(1)
            }
        })

    auth.command('status')
        .description('Show current authentication state')
        .option('--json', 'Output JSON')
        .action(async (options: { json?: boolean }) => {
            const status = await getAuthStatus()
            if (options.json) {
                console.log(JSON.stringify(status, null, 2))
                return
            }
            console.log(formatAuthStatus(status))
        })

    auth.command('logout')
        .description('Clear saved authentication')
        .option('--json', 'Output JSON')
        .action(async (options: { json?: boolean }) => {
            try {
                const result = await clearApiKey()
                if (options.json) {
                    console.log(JSON.stringify(result, null, 2))
                    return
                }

                console.log('Granola auth cleared')
                console.log(
                    `- secure store: ${result.clearedSecureStore ? 'cleared' : 'not used or unavailable'}`,
                )
                console.log(
                    `- config file: ${result.clearedConfigFile ? 'cleared' : 'already empty'}`,
                )
                console.log('- next: granola auth login')
                console.log(
                    '- note: GRANOLA_API_KEY in your environment still overrides stored auth',
                )
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                console.error(formatError('AUTH_LOGOUT_FAILED', message))
                process.exit(1)
            }
        })
}

async function getAuthStatus(): Promise<AuthStatus> {
    const { token, source } = await resolveApiKey()
    const status = buildAuthStatus(source)

    if (!token) {
        return status
    }

    try {
        const client = new GranolaApiClient(token)
        await withSpinner({ text: 'Checking authentication...', color: 'blue' }, () =>
            client.validateApiKey(),
        )
        return {
            ...status,
            authenticated: true,
            notes: 'Granola API key accepted',
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
            ...status,
            notes:
                error instanceof GranolaError && error.code === 'AUTH_ERROR'
                    ? `${message}. Personal API keys require a Granola Business or Enterprise workspace.`
                    : message,
        }
    }
}

function buildAuthStatus(source: ApiKeySource, overrides: Partial<AuthStatus> = {}): AuthStatus {
    const state = loadState()
    return {
        authenticated: false,
        source,
        cacheDir: CACHE_DIR,
        configPath: CONFIG_PATH,
        notesCached: Object.keys(state.notes).length,
        lastSyncAt: state.lastSyncAt,
        lastFullSyncAt: state.lastFullSyncAt,
        apiBaseUrl: getApiBaseUrl(),
        planRequirement:
            'Personal API keys require a Granola Business or Enterprise workspace; team-wide access requires Enterprise API.',
        notes: 'Run `granola auth login` or set GRANOLA_API_KEY.',
        ...overrides,
    }
}

function formatAuthStatus(result: AuthStatus): string {
    const lines = [
        `Granola auth: ${result.authenticated ? 'ready' : 'not ready'}`,
        `- source: ${result.source}`,
        `- cached notes: ${result.notesCached}`,
        `- last sync: ${result.lastSyncAt || 'never'}`,
    ]

    if (!result.authenticated) {
        lines.push(`- note: ${result.notes}`)
        lines.push('- next: granola auth login')
    } else {
        lines.push(`- next: ${result.notesCached > 0 ? 'granola list' : 'granola sync --full'}`)
    }

    return lines.join('\n')
}

function formatLoginResult(result: LoginPayload): string {
    const lines = [
        chalk.green('Granola auth: ready'),
        `- source: ${result.source}`,
        `- stored in: ${result.storage}`,
        `- cached notes: ${result.notesCached}`,
        `- next: ${result.notesCached > 0 ? 'granola list' : 'granola sync --full'}`,
    ]

    if (result.storageWarning) {
        lines.push(`- warning: ${result.storageWarning}`)
    }
    if (result.envWarning) {
        lines.push(`- warning: ${result.envWarning}`)
    }

    return lines.join('\n')
}

export async function readMaskedLine(
    input: KeypressInput,
    output: KeypressOutput,
    prompt = 'Granola API key: ',
): Promise<string> {
    if (!input.isTTY || !output.isTTY) {
        return ''
    }

    return new Promise((resolve, reject) => {
        let token = ''
        let rawModeEnabled = false

        const cleanup = () => {
            input.off('keypress', onKeypress)
            if (rawModeEnabled) {
                input.setRawMode?.(false)
            }
            input.pause()
        }

        const finish = () => {
            output.write('\n')
            cleanup()
            resolve(token.trim())
        }

        const cancel = () => {
            output.write('\n')
            cleanup()
            reject(new GranolaError('AUTH_ERROR', 'Authentication cancelled'))
        }

        const onKeypress = (chunk: string, key: KeypressInfo = {}) => {
            if (key.ctrl && key.name === 'c') {
                cancel()
                return
            }

            if (key.name === 'return' || key.name === 'enter') {
                finish()
                return
            }

            if (key.name === 'backspace') {
                if (!token) {
                    return
                }
                token = token.slice(0, -1)
                output.write('\b \b')
                return
            }

            if (key.ctrl || key.meta) {
                return
            }

            const value = sanitizeMaskedInput(chunk || key.sequence || '')
            if (!value) {
                return
            }

            token += value
            output.write('*'.repeat([...value].length))
        }

        output.write(prompt)
        input.on('keypress', onKeypress)
        input.resume()
        if (typeof input.setRawMode === 'function') {
            input.setRawMode(true)
            rawModeEnabled = true
        }
    })
}

async function promptForApiKey(): Promise<string> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        return ''
    }

    emitKeypressEvents(process.stdin)
    return readMaskedLine(process.stdin as KeypressInput, process.stdout as KeypressOutput)
}

function sanitizeMaskedInput(value: string): string {
    return [...value]
        .filter((char) => {
            const code = char.charCodeAt(0)
            return code >= 0x20 && code !== 0x7f
        })
        .join('')
}
