export const STORAGE_KEYS = {
  BOOK_INDEX: "books:index",
  BOOK_PREFIX: "books:chapter:",
  VAULT_SALT: "vault:salt",
  VAULT_DATA: "vault:data",
  LIBRARIAN_JOBS_INDEX: "librarian:jobs:index",
  LIBRARIAN_JOB_PREFIX: "librarian:job:",
} as const

export const PORT_NAMES = {
  AGENT_STATUS: "agent-status",
} as const

export const MESSAGE_NAMES = {
  START_FEED: "start-feed",
  SETUP_PERSONA: "setup-persona",
  START_LIBRARIAN: "start-librarian",
  APPROVE_SUBMIT: "approve-submit",
} as const
