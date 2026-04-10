import { describe, expect, it } from 'vitest'
import { isNewer, parseVersion } from './action.js'

describe('update version helpers', () => {
    it('parses versions with prerelease identifiers', () => {
        expect(parseVersion('1.2.3-next.4')).toEqual({
            major: 1,
            minor: 2,
            patch: 3,
            prerelease: 'next.4',
        })
    })

    it('detects newer stable versions', () => {
        expect(isNewer('1.0.0', '1.1.0')).toBe(true)
        expect(isNewer('1.1.0', '1.0.0')).toBe(false)
    })

    it('treats stable as newer than prerelease of same core version', () => {
        expect(isNewer('1.0.0-next.1', '1.0.0')).toBe(true)
        expect(isNewer('1.0.0', '1.0.0-next.1')).toBe(false)
    })

    it('compares prerelease numbers numerically', () => {
        expect(isNewer('1.0.0-next.2', '1.0.0-next.10')).toBe(true)
    })
})
