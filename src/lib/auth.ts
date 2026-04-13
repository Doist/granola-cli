import { CONFIG_PATH, readCliConfig, writeCliConfig, type CliConfig as Config } from './config.js'
import { GranolaError } from './errors.js'
import type { LoginResult, LogoutResult, ResolvedApiKey } from './types.js'

export { CONFIG_DIR, CONFIG_PATH } from './config.js'

const SERVICE_NAME = 'granola-cli'
const ACCOUNT_NAME = 'api-key'

class SecureStoreUnavailableError extends Error {
    constructor(message = 'System credential storage is unavailable') {
        super(message)
        this.name = 'SecureStoreUnavailableError'
    }
}

export async function resolveApiKey(): Promise<ResolvedApiKey> {
    const envToken = process.env.GRANOLA_API_KEY?.trim()
    if (envToken) {
        return { token: envToken, source: 'env' }
    }

    const saved = await getSavedApiKey()
    if (saved) {
        return saved
    }

    return { token: null, source: 'none' }
}

export async function getRequiredApiKey(): Promise<string> {
    const resolved = await resolveApiKey()
    if (resolved.token) {
        return resolved.token
    }

    throw new GranolaError(
        'AUTH_ERROR',
        'Granola API key missing. Run `granola auth login` or set GRANOLA_API_KEY.',
    )
}

export async function getSavedApiKey(): Promise<ResolvedApiKey | null> {
    const config = await readCliConfig()
    const configKey = getConfigKey(config)

    if (configKey) {
        try {
            const secureStore = await createSecureStore()
            await secureStore.setSecret(configKey)
            await writeCliConfig(withoutConfigKey(config))
            return { token: configKey, source: 'secure-store' }
        } catch (error) {
            if (!(error instanceof SecureStoreUnavailableError)) {
                throw error
            }
            return { token: configKey, source: 'config-file' }
        }
    }

    try {
        const secureStore = await createSecureStore()
        const token = await secureStore.getSecret()
        if (token?.trim()) {
            return { token: token.trim(), source: 'secure-store' }
        }
    } catch (error) {
        if (!(error instanceof SecureStoreUnavailableError)) {
            throw error
        }
    }

    return null
}

export async function saveApiKey(token: string): Promise<LoginResult> {
    const trimmedToken = token.trim()
    if (!trimmedToken) {
        throw new GranolaError('AUTH_ERROR', 'Granola API key cannot be empty')
    }

    const existingConfig = await readCliConfig()

    try {
        const secureStore = await createSecureStore()
        await secureStore.setSecret(trimmedToken)
        await writeCliConfig(withoutConfigKey(existingConfig))
        return { storage: 'secure-store' }
    } catch (error) {
        if (!(error instanceof SecureStoreUnavailableError)) {
            throw error
        }
    }

    await writeCliConfig({
        ...withoutConfigKey(existingConfig),
        api_key: trimmedToken,
    })

    return {
        storage: 'config-file',
        warning: `System credential manager unavailable; stored key in ${CONFIG_PATH}`,
    }
}

export async function clearApiKey(): Promise<LogoutResult> {
    const config = await readCliConfig()
    let clearedSecureStore = false

    try {
        const secureStore = await createSecureStore()
        await secureStore.deleteSecret()
        clearedSecureStore = true
    } catch (error) {
        if (!(error instanceof SecureStoreUnavailableError)) {
            throw error
        }
    }

    await writeCliConfig(withoutConfigKey(config))

    return {
        clearedSecureStore,
        clearedConfigFile: Boolean(getConfigKey(config)),
    }
}

async function createSecureStore(): Promise<{
    getSecret: () => Promise<string | null>
    setSecret: (secret: string) => Promise<void>
    deleteSecret: () => Promise<void>
}> {
    try {
        const { AsyncEntry } = await import('@napi-rs/keyring')
        const entry = new AsyncEntry(SERVICE_NAME, ACCOUNT_NAME)
        return {
            async getSecret() {
                try {
                    return (await entry.getPassword()) ?? null
                } catch (error) {
                    throw toUnavailableError(error)
                }
            },
            async setSecret(secret: string) {
                try {
                    await entry.setPassword(secret)
                } catch (error) {
                    throw toUnavailableError(error)
                }
            },
            async deleteSecret() {
                try {
                    await entry.deleteCredential()
                } catch (error) {
                    throw toUnavailableError(error)
                }
            },
        }
    } catch (error) {
        throw toUnavailableError(error)
    }
}

function getConfigKey(config: Config): string | null {
    if (typeof config.api_key === 'string' && config.api_key.trim()) {
        return config.api_key.trim()
    }
    return null
}

function withoutConfigKey(config: Config): Config {
    const { api_key: _apiKey, ...rest } = config
    return rest
}

function toUnavailableError(error: unknown): SecureStoreUnavailableError {
    if (error instanceof SecureStoreUnavailableError) {
        return error
    }

    const message =
        error instanceof Error ? error.message : 'System credential storage is unavailable'
    return new SecureStoreUnavailableError(message)
}
