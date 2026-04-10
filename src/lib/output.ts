import chalk from 'chalk'
import type { SyncResult } from './types.js'

export interface OutputOptions {
    json?: boolean
    ndjson?: boolean
    full?: boolean
}

export function getOutputOptions(opts: Record<string, unknown>): OutputOptions {
    return {
        json: Boolean(opts.json),
        ndjson: Boolean(opts.ndjson),
        full: Boolean(opts.full),
    }
}

export function outputItem<T extends object>(
    item: T,
    humanFormatter: (item: T) => string,
    essentialKeys?: (keyof T)[],
    opts: OutputOptions = {},
): void {
    if (opts.ndjson) {
        const data = opts.full || !essentialKeys ? item : pick(item, essentialKeys)
        console.log(JSON.stringify(data))
        return
    }
    if (opts.json) {
        const data = opts.full || !essentialKeys ? item : pick(item, essentialKeys)
        console.log(JSON.stringify(data, null, 2))
        return
    }
    console.log(humanFormatter(item))
}

export function outputList<T extends object>(
    items: T[],
    humanFormatter: (item: T) => string,
    essentialKeys?: (keyof T)[],
    opts: OutputOptions = {},
): void {
    if (opts.ndjson) {
        for (const item of items) {
            const data = opts.full || !essentialKeys ? item : pick(item, essentialKeys)
            console.log(JSON.stringify(data))
        }
        return
    }

    if (opts.json) {
        const data = items.map((item) =>
            opts.full || !essentialKeys ? item : pick(item, essentialKeys),
        )
        console.log(JSON.stringify(data, null, 2))
        return
    }

    for (const item of items) {
        console.log(humanFormatter(item))
    }
}

export function formatError(code: string, message: string, hints?: string[]): string {
    const lines = [`Error: ${code}`, message]
    if (hints && hints.length > 0) {
        lines.push('')
        for (const hint of hints) {
            lines.push(`  - ${hint}`)
        }
    }
    return chalk.red(lines.join('\n'))
}

export function formatLocalDate(
    value: string | null | undefined,
    options: { withTime?: boolean } = {},
): string {
    if (!value) {
        return 'Unknown date'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return String(value)
    }

    return new Intl.DateTimeFormat(
        undefined,
        options.withTime
            ? {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
              }
            : { year: 'numeric', month: 'short', day: 'numeric' },
    ).format(date)
}

export function summarizeNamesForDisplay(names: string[], limit = 3): string | null {
    if (!Array.isArray(names) || names.length === 0) {
        return null
    }
    if (names.length <= limit) {
        return names.join(', ')
    }
    return `${names.slice(0, limit).join(', ')} +${names.length - limit}`
}

export function formatSyncBanner(sync: SyncResult | null | undefined): string | null {
    if (!sync) {
        return null
    }

    const details: string[] = []
    if (sync.fetched === 0 && sync.removed === 0 && sync.failed === 0) {
        details.push('up to date')
    } else {
        if (sync.fetched > 0) {
            details.push(`${sync.fetched} fetched`)
        }
        if (sync.removed > 0) {
            details.push(`${sync.removed} removed`)
        }
        if (sync.failed > 0) {
            details.push(`${sync.failed} failed`)
        }
    }
    details.push(`${sync.totalCached} cached`)

    return `Sync: ${sync.mode} · ${details.join(' · ')}`
}

export function formatMatchedFields(
    matchedFields: Array<{ key: string; terms: string[] }> | null | undefined,
): string | null {
    if (!matchedFields || matchedFields.length === 0) {
        return null
    }
    return matchedFields.map((field) => `${field.key}(${field.terms.join(', ')})`).join(', ')
}

function pick<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
    const result: Partial<T> = {}
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key]
        }
    }
    return result
}
