import { Agent, type Dispatcher, EnvHttpProxyAgent } from 'undici'

const PROXY_ENV_KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'] as const

let defaultDispatcher: Dispatcher | undefined

function hasProxyEnv(): boolean {
    for (const key of PROXY_ENV_KEYS) {
        if (process.env[key]) {
            return true
        }
    }

    return false
}

function createDefaultDispatcher(): Dispatcher {
    if (hasProxyEnv()) {
        return new EnvHttpProxyAgent()
    }

    return new Agent()
}

export function getDefaultDispatcher(): Dispatcher {
    defaultDispatcher ??= createDefaultDispatcher()
    return defaultDispatcher
}

export async function resetDefaultDispatcherForTests(): Promise<void> {
    if (!defaultDispatcher) {
        return
    }

    const dispatcher = defaultDispatcher
    defaultDispatcher = undefined
    await dispatcher.close()
}
