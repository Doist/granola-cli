import { readCliConfig, writeCliConfig, type UpdateChannel } from './config.js'

export type { UpdateChannel } from './config.js'

export async function getUpdateChannel(): Promise<UpdateChannel> {
    const config = await readCliConfig()
    return config.update_channel ?? 'stable'
}

export async function setUpdateChannel(channel: UpdateChannel): Promise<void> {
    const existing = await readCliConfig()
    await writeCliConfig({
        ...existing,
        update_channel: channel,
    })
}
