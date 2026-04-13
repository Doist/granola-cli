import { describe, expect, it } from 'vitest'
import { parseListOptions, parseShowOptions } from './shared.js'

describe('shared command options', () => {
    it('maps Commander no-sync flags for list-style commands', () => {
        expect(parseListOptions({ limit: '20', sync: false }).noSync).toBe(true)
        expect(parseListOptions({ limit: '20' }).noSync).toBe(false)
    })

    it('maps Commander no-sync flags for show commands', () => {
        expect(parseShowOptions({ sync: false }).noSync).toBe(true)
        expect(parseShowOptions({}).noSync).toBe(false)
    })
})
