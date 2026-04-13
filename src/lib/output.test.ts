import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    formatError,
    formatLocalDate,
    formatMatchedFields,
    formatSyncBanner,
    getOutputOptions,
    outputItem,
    outputList,
    summarizeNamesForDisplay,
} from './output.js'

describe('output', () => {
    let logs: string[]

    beforeEach(() => {
        logs = []
        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logs.push(args.join(' '))
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    const item = { id: '1', name: 'Test', extra: 'hidden' }
    const formatter = (value: typeof item) => `${value.name} (${value.id})`
    const keys: (keyof typeof item)[] = ['id', 'name']

    it('outputItem human mode', () => {
        outputItem(item, formatter, keys)
        expect(logs[0]).toBe('Test (1)')
    })

    it('outputItem json mode shows essential keys only', () => {
        outputItem(item, formatter, keys, { json: true })
        expect(JSON.parse(logs[0])).toEqual({ id: '1', name: 'Test' })
    })

    it('outputList ndjson mode', () => {
        outputList([item, { ...item, id: '2' }], formatter, keys, { ndjson: true })
        expect(logs).toHaveLength(2)
        expect(JSON.parse(logs[0])).toEqual({ id: '1', name: 'Test' })
        expect(JSON.parse(logs[1])).toEqual({ id: '2', name: 'Test' })
    })

    it('parses output flags', () => {
        expect(getOutputOptions({ json: true, ndjson: false, full: true })).toEqual({
            json: true,
            ndjson: false,
            full: true,
        })
    })

    it('formats sync banners', () => {
        expect(
            formatSyncBanner({
                mode: 'incremental',
                listed: 0,
                fetched: 0,
                failed: 0,
                failures: [],
                removed: 0,
                totalCached: 10,
                lastSyncAt: '2026-01-01T00:00:00Z',
                lastFullSyncAt: '2026-01-01T00:00:00Z',
            }),
        ).toBe('Sync: incremental · up to date · 10 cached')
    })

    it('formats matched fields', () => {
        expect(
            formatMatchedFields([
                { key: 'title', terms: ['roadmap'] },
                { key: 'people', terms: ['alice'] },
            ]),
        ).toBe('title(roadmap), people(alice)')
    })

    it('summarizes names for display', () => {
        expect(summarizeNamesForDisplay(['A', 'B', 'C', 'D'], 2)).toBe('A, B +2')
    })

    it('formats local dates', () => {
        expect(formatLocalDate('2026-04-07T10:00:00Z')).toContain('2026')
    })

    it('formats errors with hints', () => {
        const result = formatError('TEST_ERROR', 'Something went wrong', ['Try this'])
        expect(result).toContain('Error: TEST_ERROR')
        expect(result).toContain('Something went wrong')
        expect(result).toContain('Try this')
    })
})
