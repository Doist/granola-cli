import { describe, expect, it } from 'vitest'
import {
    compactWhitespace,
    extractTranscriptSegments,
    flattenTranscript,
    formatTranscript,
    formatTranscriptTimestamp,
} from './transcript.js'

describe('transcript', () => {
    it('compacts whitespace', () => {
        expect(compactWhitespace(' one\n\n two ')).toBe('one two')
    })

    it('flattens nested transcript content', () => {
        expect(flattenTranscript([{ text: 'Hello' }, { nested: ['there'] }])).toBe('Hello there')
    })

    it('extracts speaker segments', () => {
        expect(
            extractTranscriptSegments([
                {
                    start_time: '2026-04-07T10:00:00Z',
                    speaker: { source: 'microphone' },
                    text: 'Hi',
                },
                { timestamp: 90, speaker_name: 'Alice', content: 'Roadmap update' },
            ]),
        ).toEqual([
            {
                speaker: 'Me',
                timestamp: formatTranscriptTimestamp('2026-04-07T10:00:00Z'),
                text: 'Hi',
            },
            { speaker: 'Alice', timestamp: '[01:30]', text: 'Roadmap update' },
        ])
    })

    it('formats transcript output', () => {
        const formatted = formatTranscript([
            {
                start_timestamp: '2026-04-07T10:00:00Z',
                speaker_name: 'Alice',
                text: 'We should hire.',
            },
        ])
        expect(formatted).toContain('Alice')
        expect(formatted).toContain('We should hire.')
    })

    it('formats timestamps from numbers and dates', () => {
        expect(formatTranscriptTimestamp(125)).toBe('[02:05]')
        expect(formatTranscriptTimestamp('2026-04-07T10:00:00Z')).toBe(
            new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
                new Date('2026-04-07T10:00:00Z'),
            ),
        )
    })
})
