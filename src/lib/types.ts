export interface GranolaPerson {
    name?: string | null
    email?: string | null
    source?: string | null
}

export interface GranolaFolderMembership {
    object?: string
    id?: string | null
    name?: string | null
}

export interface GranolaCalendarEvent {
    scheduled_start_time?: string | null
    organiser?: string | null
    invitees?: Array<GranolaPerson | string> | null
    event_title?: string | null
}

export interface GranolaNoteSummary {
    id: string
    object?: string
    title?: string | null
    owner?: GranolaPerson | null
    created_at?: string | null
    updated_at?: string | null
}

export interface GranolaNote extends GranolaNoteSummary {
    calendar_event?: GranolaCalendarEvent | null
    attendees?: Array<GranolaPerson | string> | null
    folder_membership?: GranolaFolderMembership[] | null
    summary_text?: string | null
    summary_markdown?: string | null
    transcript?: unknown
}

export interface GranolaListNotesResponse {
    notes?: GranolaNoteSummary[]
    hasMore?: boolean
    cursor?: string | null
}

export interface NoteFolder {
    id: string | null
    name: string | null
}

export interface CachedNoteRecord {
    schemaVersion: number
    cachedAt: string
    note: GranolaNote
}

export interface IndexedNote {
    id: string
    title: string
    createdAt: string | null
    updatedAt: string | null
    meetingDate: string | null
    ownerName: string | null
    ownerEmail: string | null
    peopleNames: string[]
    peopleSearch: string[]
    folders: NoteFolder[]
    preview: string
    file: string
}

export interface CacheState {
    schemaVersion: number
    lastSyncAt: string | null
    lastFullSyncAt: string | null
    notes: Record<string, IndexedNote>
}

export interface SyncResult {
    mode: 'full' | 'incremental'
    listed: number
    fetched: number
    failed: number
    failures: Array<{ noteId: string; message: string }>
    removed: number
    totalCached: number
    lastSyncAt: string | null
    lastFullSyncAt: string | null
}

export interface SearchFilters {
    after?: string | null
    before?: string | null
    person?: string | null
    folder?: string | null
}

export interface MatchedField {
    key: 'title' | 'people' | 'folders' | 'summary' | 'transcript'
    terms: string[]
}

export interface SearchScore {
    matches: boolean
    score: number
    matchedFields: MatchedField[]
    excerpt: string | null
}

export interface SearchResult extends IndexedNote {
    score: number
    matchedFields: MatchedField[]
    excerpt: string | null
}

export interface FolderSummary {
    id: string | null
    name: string
    noteCount: number
    latestMeetingDate: string | null
}

export type ApiKeySource = 'env' | 'secure-store' | 'config-file' | 'none'

export interface AuthStatus {
    authenticated: boolean
    source: ApiKeySource
    cacheDir: string
    configPath: string
    notesCached: number
    lastSyncAt: string | null
    lastFullSyncAt: string | null
    apiBaseUrl: string
    planRequirement: string
    notes: string
}

export interface LoginResult {
    storage: 'secure-store' | 'config-file'
    warning?: string
}

export interface LogoutResult {
    clearedSecureStore: boolean
    clearedConfigFile: boolean
}

export interface ResolvedApiKey {
    token: string | null
    source: ApiKeySource
}
