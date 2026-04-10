import { fetchWithRetry } from '../transport/fetch-with-retry.js'
import { GranolaError } from './errors.js'
import type { GranolaListNotesResponse, GranolaNote } from './types.js'

const DEFAULT_API_BASE_URL = 'https://public-api.granola.ai/v1'
const REQUEST_INTERVAL_MS = 260
const DEFAULT_PAGE_SIZE = 30

export class GranolaApiClient {
    private readonly apiKey: string
    private readonly baseUrl: string
    private lastRequestAt = 0

    constructor(apiKey: string, baseUrl = getApiBaseUrl()) {
        this.apiKey = apiKey
        this.baseUrl = baseUrl
    }

    async listNotes(
        params: Record<string, string | number | null | undefined> = {},
    ): Promise<GranolaListNotesResponse> {
        return this.request<GranolaListNotesResponse>('/notes', {
            page_size: DEFAULT_PAGE_SIZE,
            ...params,
        })
    }

    async getNote(noteId: string): Promise<GranolaNote> {
        return this.request<GranolaNote>(`/notes/${noteId}`, { include: 'transcript' })
    }

    async validateApiKey(): Promise<void> {
        await this.listNotes({ page_size: 1 })
    }

    private async request<T>(
        endpoint: string,
        params: Record<string, string | number | null | undefined> = {},
    ): Promise<T> {
        await this.waitForRateLimit()

        const url = new URL(this.baseUrl + endpoint)
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === '') {
                continue
            }
            url.searchParams.set(key, String(value))
        }

        let response: Response
        try {
            response = await fetchWithRetry({
                url,
                options: {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                },
                retryConfig: {
                    retries: 2,
                },
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new GranolaError('NETWORK_ERROR', `Granola API request failed: ${message}`)
        }

        if (response.status === 401 || response.status === 403) {
            throw new GranolaError('AUTH_ERROR', 'Granola API key rejected')
        }

        if (response.status === 429) {
            throw new GranolaError('RATE_LIMITED', 'Granola API rate limit exceeded')
        }

        if (!response.ok) {
            const details = await safeReadText(response)
            throw new GranolaError(
                'API_ERROR',
                `Granola API returned ${response.status}`,
                details || undefined,
            )
        }

        try {
            return (await response.json()) as T
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new GranolaError('API_ERROR', `Granola API returned invalid JSON: ${message}`)
        }
    }

    private async waitForRateLimit(): Promise<void> {
        const now = Date.now()
        const waitMs = REQUEST_INTERVAL_MS - (now - this.lastRequestAt)
        if (waitMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitMs))
        }
        this.lastRequestAt = Date.now()
    }
}

export function getApiBaseUrl(): string {
    return (process.env.GRANOLA_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

async function safeReadText(response: Response): Promise<string> {
    try {
        return (await response.text()).trim()
    } catch {
        return ''
    }
}
