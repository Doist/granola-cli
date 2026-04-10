import type { Command } from 'commander'
import { GranolaError } from '../lib/errors.js'
import { getOutputOptions, type OutputOptions } from '../lib/output.js'
import { normalizeDateBoundary, parseLimit, validateDateRange } from '../lib/search.js'
import type { SearchFilters } from '../lib/types.js'

export interface ParsedListOptions {
    after: string | null
    before: string | null
    person: string | null
    folder: string | null
    limit: number
    noSync: boolean
    output: OutputOptions
}

export interface ParsedShowOptions {
    transcript: boolean
    noSync: boolean
    output: OutputOptions
}

export interface ParsedSyncOptions {
    full: boolean
    output: OutputOptions
}

export function addListQueryOptions(
    command: Command,
    options: { includeFolder?: boolean } = {},
): Command {
    const includeFolder = options.includeFolder ?? true

    command
        .option('--person <text>', 'Filter by attendee/owner name or email')
        .option('--after <date>', 'Filter to notes on or after a date')
        .option('--before <date>', 'Filter to notes on or before a date')
        .option('--limit <n>', 'Max results', '20')
        .option('--no-sync', 'Use the local cache without syncing first')
        .option('--json', 'Output JSON')
        .option('--ndjson', 'Output NDJSON')
        .option('--full', 'Include full fields in JSON or NDJSON output')

    if (includeFolder) {
        command.option('--folder <text>', 'Filter by folder name or ID')
    }

    return command
}

export function addJsonOption(command: Command): Command {
    return command.option('--json', 'Output JSON')
}

export function addShowOptions(command: Command): Command {
    return command
        .option('--transcript', 'Include transcript in the output')
        .option('--no-sync', 'Use the local cache without syncing first')
        .option('--json', 'Output JSON')
        .option('--full', 'Include raw note fields in JSON output')
}

export function addSyncOptions(command: Command): Command {
    return command.option('--full', 'Force a full sync').option('--json', 'Output JSON')
}

export function parseListOptions(raw: Record<string, unknown>): ParsedListOptions {
    const output = getOutputOptions(raw)
    validateOutputModes(output)

    const filters: SearchFilters = {
        after: normalizeOptionalDate(raw.after, 'start'),
        before: normalizeOptionalDate(raw.before, 'end'),
        person: normalizeOptionalText(raw.person),
        folder: normalizeOptionalText(raw.folder),
    }
    validateDateRange(filters)

    return {
        after: filters.after ?? null,
        before: filters.before ?? null,
        person: filters.person ?? null,
        folder: filters.folder ?? null,
        limit: parseLimit(raw.limit as string | number | undefined),
        noSync: raw.sync === false,
        output,
    }
}

export function parseShowOptions(raw: Record<string, unknown>): ParsedShowOptions {
    const output = getOutputOptions(raw)
    if (output.ndjson) {
        throw new GranolaError('USAGE_ERROR', '--ndjson is not supported for `granola show`')
    }
    return {
        transcript: Boolean(raw.transcript),
        noSync: raw.sync === false,
        output,
    }
}

export function parseSyncOptions(raw: Record<string, unknown>): ParsedSyncOptions {
    const output = {
        json: Boolean(raw.json),
    }
    return {
        full: Boolean(raw.full),
        output,
    }
}

function normalizeOptionalDate(value: unknown, edge: 'start' | 'end'): string | null {
    if (typeof value !== 'string' || !value.trim()) {
        return null
    }
    return normalizeDateBoundary(value.trim(), edge)
}

function normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) {
        return null
    }
    return value.trim()
}

function validateOutputModes(output: OutputOptions): void {
    if (output.json && output.ndjson) {
        throw new GranolaError('USAGE_ERROR', 'Specify either --json or --ndjson, not both')
    }
}
