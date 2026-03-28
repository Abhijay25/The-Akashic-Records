import type { FeedConfig, BookStatus } from "./book"

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
  entriesCount: number
  message?: string
}
