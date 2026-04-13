export interface TranscriptSegment {
    speaker: string | null
    timestamp: string | null
    text: string
}

export function compactWhitespace(text: string | null | undefined): string {
    return String(text ?? '')
        .replace(/\s+/g, ' ')
        .trim()
}

export function flattenTranscript(transcript: unknown): string {
    const strings: string[] = []
    collectStrings(transcript, strings)
    return compactWhitespace(strings.join(' '))
}

export function formatTranscript(transcript: unknown): string | null {
    const segments = extractTranscriptSegments(transcript)
    if (segments.length === 0) {
        const fallback = flattenTranscript(transcript)
        return fallback || null
    }

    return segments
        .map((segment) => {
            const prefix = [segment.timestamp, segment.speaker].filter(Boolean).join('  ')
            return prefix ? `${prefix}\n  ${segment.text}` : segment.text
        })
        .join('\n\n')
}

export function extractTranscriptSegments(transcript: unknown): TranscriptSegment[] {
    if (!Array.isArray(transcript)) {
        return []
    }

    return transcript
        .map((segment) => {
            if (!segment || typeof segment !== 'object') {
                return null
            }

            const record = segment as Record<string, unknown>
            const speaker = extractSpeaker(record)
            const timestamp = formatTranscriptTimestamp(
                record.timestamp ??
                    record.start_timestamp ??
                    record.started_at ??
                    record.startTime ??
                    record.start_time ??
                    record.time,
            )
            const text = compactWhitespace(
                getFirstString(
                    record.text,
                    record.content,
                    record.body,
                    record.transcript,
                    record.message,
                ),
            )

            if (!text) {
                return null
            }

            return { speaker, timestamp, text }
        })
        .filter((segment): segment is TranscriptSegment => segment !== null)
}

export function formatTranscriptTimestamp(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
        return null
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        const totalSeconds = Math.max(0, Math.floor(value))
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`
    }

    const maybeDate = new Date(String(value))
    if (!Number.isNaN(maybeDate.getTime())) {
        return new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
        }).format(maybeDate)
    }

    return String(value)
}

function extractSpeaker(segment: Record<string, unknown>): string | null {
    const direct = getFirstString(segment.speaker_name, segment.name, segment.speaker)
    if (direct) {
        return direct
    }

    const speakerRecord = isRecord(segment.speaker) ? segment.speaker : null
    if (speakerRecord) {
        const named = getFirstString(speakerRecord.name)
        if (named) {
            return named
        }

        const source = getFirstString(speakerRecord.source)
        if (source === 'microphone') {
            return 'Me'
        }
        if (source === 'system') {
            return 'System'
        }
    }

    const personRecord = isRecord(segment.person) ? segment.person : null
    if (personRecord) {
        const named = getFirstString(personRecord.name)
        if (named) {
            return named
        }
    }

    return null
}

function collectStrings(value: unknown, output: string[]): void {
    if (value === null || value === undefined) {
        return
    }

    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed) {
            output.push(trimmed)
        }
        return
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            collectStrings(item, output)
        }
        return
    }

    if (typeof value === 'object') {
        for (const item of Object.values(value)) {
            collectStrings(item, output)
        }
    }
}

function getFirstString(...values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim()
        }
    }
    return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
