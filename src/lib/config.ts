import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export type UpdateChannel = 'stable' | 'pre-release'

export interface CliConfig {
    api_key?: string
    update_channel?: UpdateChannel
}

export const CONFIG_DIR = join(homedir(), '.config', 'granola-cli')
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

export async function readCliConfig(): Promise<CliConfig> {
    try {
        const content = await readFile(CONFIG_PATH, 'utf8')
        const parsed = JSON.parse(content) as unknown
        return isCliConfig(parsed) ? parsed : {}
    } catch {
        return {}
    }
}

export async function writeCliConfig(config: CliConfig): Promise<void> {
    if (Object.keys(config).length === 0) {
        try {
            await unlink(CONFIG_PATH)
        } catch (error) {
            if (!isMissingFileError(error)) {
                throw error
            }
        }
        return
    }

    await mkdir(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 })
    await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
    })
    await chmod(CONFIG_PATH, 0o600)
}

function isMissingFileError(error: unknown): boolean {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function isCliConfig(value: unknown): value is CliConfig {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
