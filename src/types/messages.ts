import type { FeedConfig, BookStatus } from "./book"
import type { TaskPayload, UserPersona, LibrarianJobStatus, ExecutionResult, LibrarianSettings } from "./librarian"

// start-feed message (popup → background)
export interface StartFeedRequest {
  config: FeedConfig
}

export interface StartFeedResponse {
  bookId: string
  error?: string
}

// agent-status port (background → popup)
export interface FeedProgressEvent {
  type: "feed-progress"
  bookId: string
  status: BookStatus
  chaptersCount: number
  message?: string
}

// setup-persona message — one-time resume parsing + vault storage
export interface SetupPersonaRequest {
  resumeText: string
  email: string
  passphrase: string
}

export interface SetupPersonaResponse {
  success: boolean
  persona?: UserPersona
  error?: string
}

// start-librarian message (popup → background)
export interface StartLibrarianRequest {
  payload: TaskPayload
  passphrase?: string
}

export interface StartLibrarianResponse {
  jobId: string
  error?: string
}

// approve-submit message — HITL approval after forms are filled
export interface ApproveSubmitRequest {
  jobId: string
  approvedUrls: string[]
}

export interface ApproveSubmitResponse {
  success: boolean
  error?: string
}

// get-librarian-settings / update-librarian-settings messages
export interface GetLibrarianSettingsResponse {
  settings: LibrarianSettings
}

export interface UpdateLibrarianSettingsRequest {
  settings: Partial<LibrarianSettings>
}

export interface UpdateLibrarianSettingsResponse {
  success: boolean
  settings: LibrarianSettings
  error?: string
}

// librarian-progress port event (background → popup via agent-status port)
export interface LibrarianProgressEvent {
  type: "librarian-progress"
  jobId: string
  status: LibrarianJobStatus
  completedCount: number
  totalCount: number
  results: ExecutionResult[]
  message?: string
}
