# The Librarian — Master Technical Blueprint

## Context

**What:** "The Librarian" is a Personal Agentic Browser (PAB) extension for the TinyFish $2M Pre-Accelerator Hackathon (March 2026).

**Problem it solves:** The "Broken UI" problem of the web — automating high-level labor on sites that lack APIs, have messy/hostile interfaces, or actively block traditional scrapers.

**Outcome:** A general-purpose browser extension with three capabilities demoed via security/privacy/productivity tasks, built by a team of 3 in parallel, demo-ready by March 29, 2026.

**Decisions made:**
- Dual-LLM: GPT-4o-mini (parse untrusted HTML) + GPT-4o (decide actions)
- Search/Triage: Tavily API (`@tavily/core`)
- API keys: `.env` files with `PLASMO_PUBLIC_` prefix
- Browser targets: Chromium (MV3) + Firefox (MV2)
- Speedreader: Full Chrome tab (`tabs/reader.tsx`)
- Persona schema: General-purpose, user fills in their own profile
- Vault key caching: Closure variable in service worker (hackathon simplicity)
- Authentication on job portals: TinyFish's built-in vault (`use_vault` + `credential_item_ids`) for auto-login; user stores creds in TinyFish dashboard, extension stores the item IDs in the Persona

---

## Phase 1: Project Initialization

### 1.1 Scaffolding Commands

```bash
# From /home/abhijay/repos
pnpm create plasmo --with-src the-librarian
cd the-librarian

# Core runtime dependencies
pnpm add zod zustand @plasmohq/storage @plasmohq/messaging openai @tavily/core @tiny-fish/sdk

# Tailwind + typography
pnpm add -D tailwindcss @tailwindcss/typography postcss autoprefixer
npx tailwindcss init -p

# Chrome types
pnpm add -D @types/chrome
```

### 1.2 Environment File

Create `.env` at project root:
```
PLASMO_PUBLIC_OPENAI_API_KEY=sk-...
PLASMO_PUBLIC_TINYFISH_API_KEY=sk-tinyfish-...
PLASMO_PUBLIC_TAVILY_API_KEY=tvly-...
```

> Only `PLASMO_PUBLIC_` prefixed vars are injected into extension code by Plasmo.

### 1.3 Tailwind Config

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./src/**/*.tsx"],
  plugins: [require("@tailwindcss/typography")]
}
```

`src/style.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 1.4 Manifest Overrides

In `package.json`, add:
```json
{
  "manifest": {
    "permissions": [
      "storage",
      "unlimitedStorage",
      "cookies",
      "tabs",
      "activeTab"
    ],
    "host_permissions": ["<all_urls>"]
  }
}
```

### 1.5 tsconfig.json Paths

Ensure `~` alias resolves to `src/`:
```json
{
  "compilerOptions": {
    "paths": { "~*": ["./src/*"] },
    "baseUrl": "."
  }
}
```

---

## Phase 2: Directory Structure

```
the-librarian/
├── .env                                    # API keys (PLASMO_PUBLIC_ prefixed)
├── .gitignore
├── assets/
│   └── icon.png                            # Extension icon (512x512)
├── package.json                            # Manifest overrides here
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
│
└── src/
    ├── style.css                           # Tailwind directives
    │
    ├── popup/
    │   └── index.tsx                       # Main popup: Bookshelf | Agent | Vault tabs
    │
    ├── tabs/
    │   └── reader.tsx                      # Speedreader: clean article view of a Book entry
    │
    ├── background/
    │   ├── index.ts                        # Service worker entry (imports nothing, Plasmo auto-discovers handlers)
    │   ├── messages/
    │   │   ├── start-feed.ts              # Handler: kick off Library feed generation
    │   │   ├── start-agent.ts             # Handler: kick off Librarian agent flow
    │   │   ├── agent-hitl-response.ts     # Handler: user approves/rejects HITL preview
    │   │   ├── vault-op.ts               # Handler: encrypt/decrypt/lock/unlock vault
    │   │   └── get-cookies.ts            # Handler: extract session cookies for a domain
    │   └── ports/
    │       └── agent-status.ts            # Port: push AgentProgressEvent / FeedProgressEvent to UI
    │
    ├── types/
    │   ├── book.ts                        # Book, BookEntry, FeedConfig schemas
    │   ├── vault.ts                       # EncryptedPayload, VaultState schemas
    │   ├── persona.ts                     # UserPersona schema (general-purpose)
    │   ├── agent.ts                       # AgentAction, AgentStep, AgentRun, ParsedPage schemas
    │   ├── messages.ts                    # All message request/response type definitions
    │   ├── tinyfish.ts                    # TinyFish SSE event types
    │   └── constants.ts                   # Storage keys, known data brokers, port names
    │
    ├── utils/
    │   ├── crypto.ts                      # PBKDF2 + AES-256-GCM vault encryption
    │   ├── tinyfish.ts                    # TinyFish SSE client wrapper
    │   ├── openai.ts                      # Dual-LLM clean room (llmA_parse + llmB_decide)
    │   ├── tavily.ts                      # Tavily scout/triage wrapper
    │   └── session.ts                     # chrome.cookies extraction
    │
    ├── store/
    │   ├── bookshelf.ts                   # Zustand: books[], addBook, updateBook, loadFromStorage
    │   ├── agent.ts                       # Zustand: currentRun, hitlPending, hitlData
    │   └── vault.ts                       # Zustand: vaultState, persona, unlock(), lock()
    │
    ├── agents/
    │   ├── threat-sentry.ts               # Feed pipeline: security forum scraping
    │   ├── digital-ghost.ts               # Action agent: data broker opt-out
    │   └── career-agent.ts                # Action agent: job portal auto-apply
    │
    └── components/
        ├── BookshelfView.tsx              # List of Books with entries
        ├── BookCard.tsx                   # Single book summary card
        ├── AgentPanel.tsx                 # Agent control: start, status, HITL
        ├── HITLPreview.tsx               # Preview form data before agent submits
        ├── VaultPanel.tsx                 # Lock/unlock UI, status indicator
        ├── PersonaForm.tsx               # Multi-section persona editor
        ├── PromptInput.tsx               # NL prompt input bar
        └── StatusBadge.tsx               # Colored status indicator
```

---

## Phase 3: Zod Data Schemas (Integration Contracts)

These are the **exact types all three teammates code against**. Every cross-boundary data exchange MUST validate through these schemas. Person C creates all of these first (Hour 0-1).

### 3.1 `src/types/book.ts`

```typescript
import { z } from "zod"

export const BookEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),                 // markdown body for Speedreader rendering
  sourceUrl: z.string().url(),
  scrapedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  read: z.boolean().default(false)
})

export const BookSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  prompt: z.string(),                  // original NL prompt that created this feed
  entries: z.array(BookEntrySchema),
  createdAt: z.string().datetime(),
  lastUpdated: z.string().datetime(),
  status: z.enum(["idle", "scouting", "scraping", "parsing", "done", "error"]),
  errorMessage: z.string().optional()
})

export const FeedConfigSchema = z.object({
  prompt: z.string().min(1),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
  maxResults: z.number().int().min(1).max(20).default(5),
  browserProfile: z.enum(["lite", "stealth"]).default("lite")
})

export type BookEntry = z.infer<typeof BookEntrySchema>
export type Book = z.infer<typeof BookSchema>
export type FeedConfig = z.infer<typeof FeedConfigSchema>
```

### 3.2 `src/types/vault.ts`

```typescript
import { z } from "zod"

export const EncryptedPayloadSchema = z.object({
  ciphertext: z.string(),             // base64-encoded
  iv: z.string(),                     // base64-encoded, 12 bytes for GCM
  salt: z.string(),                   // base64-encoded, 16 bytes for PBKDF2
  version: z.literal(1)
})

export const VaultStateSchema = z.enum(["locked", "unlocked", "uninitialized"])

export type EncryptedPayload = z.infer<typeof EncryptedPayloadSchema>
export type VaultState = z.infer<typeof VaultStateSchema>
```

### 3.3 `src/types/persona.ts`

```typescript
import { z } from "zod"

export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  gpa: z.string().optional()
})

export const WorkExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  description: z.string().optional(),
  current: z.boolean().default(false)
})

export const UserPersonaSchema = z.object({
  // Identity
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string()
  }).optional(),
  dateOfBirth: z.string().optional(),

  // Professional
  education: z.array(EducationSchema).default([]),
  workHistory: z.array(WorkExperienceSchema).default([]),
  skills: z.array(z.string()).default([]),
  resumeMarkdown: z.string().optional(),

  // Links
  linkedinUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),

  // TinyFish credential mappings (domain -> TinyFish vault item ID)
  credentialMappings: z.record(z.string(), z.string()).default({})
})

export type Education = z.infer<typeof EducationSchema>
export type WorkExperience = z.infer<typeof WorkExperienceSchema>
export type UserPersona = z.infer<typeof UserPersonaSchema>
```

### 3.4 `src/types/agent.ts`

```typescript
import { z } from "zod"

export const ParsedPageSchema = z.object({
  pageTitle: z.string(),
  pageUrl: z.string().url(),
  formFields: z.array(z.object({
    label: z.string(),
    type: z.string(),
    name: z.string(),
    required: z.boolean(),
    options: z.array(z.string()).optional()
  })).optional(),
  links: z.array(z.object({
    text: z.string(),
    href: z.string()
  })).optional(),
  textContent: z.string().optional()
})

export const AgentActionSchema = z.object({
  type: z.enum([
    "navigate", "fill_field", "click", "submit_form",
    "extract_data", "wait", "request_hitl", "done", "error"
  ]),
  target: z.string().optional(),
  value: z.string().optional(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1)
})

export const AgentStepSchema = z.object({
  stepIndex: z.number().int(),
  action: AgentActionSchema,
  timestamp: z.string().datetime(),
  result: z.enum(["pending", "success", "failed", "awaiting_hitl"]),
  screenshotUrl: z.string().optional()
})

export const AgentRunSchema = z.object({
  id: z.string().uuid(),
  agentType: z.enum(["threat-sentry", "digital-ghost", "career-agent"]),
  status: z.enum(["idle", "running", "paused_hitl", "completed", "error"]),
  goal: z.string(),
  steps: z.array(AgentStepSchema),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  errorMessage: z.string().optional()
})

export type ParsedPage = z.infer<typeof ParsedPageSchema>
export type AgentAction = z.infer<typeof AgentActionSchema>
export type AgentStep = z.infer<typeof AgentStepSchema>
export type AgentRun = z.infer<typeof AgentRunSchema>
```

### 3.5 `src/types/messages.ts`

```typescript
import type { FeedConfig } from "./book"
import type { AgentRun } from "./agent"
import type { VaultState } from "./vault"
import type { UserPersona } from "./persona"

// ---- start-feed ----
export interface StartFeedRequest { config: FeedConfig }
export interface StartFeedResponse { bookId: string }

// ---- start-agent ----
export interface StartAgentRequest {
  agentType: "digital-ghost" | "career-agent"
  goal: string
  targetUrl?: string
}
export interface StartAgentResponse { runId: string }

// ---- agent-hitl-response ----
export interface AgentHITLResponseRequest {
  runId: string
  approved: boolean
  modifications?: Record<string, string>
}
export interface AgentHITLResponseResponse { acknowledged: boolean }

// ---- vault-op ----
export interface VaultOpRequest {
  operation: "init" | "unlock" | "lock" | "get-persona" | "save-persona"
  masterPassword?: string
  persona?: UserPersona
}
export interface VaultOpResponse {
  state: VaultState
  persona?: UserPersona
  error?: string
}

// ---- get-cookies ----
export interface GetCookiesRequest { domain: string }
export interface GetCookiesResponse { cookies: Array<{ name: string; value: string }> }

// ---- Port push events (background -> UI via agent-status port) ----
export interface AgentProgressEvent {
  type: "agent-progress"
  runId: string
  run: AgentRun
}

export interface FeedProgressEvent {
  type: "feed-progress"
  bookId: string
  status: string
  entriesCount: number
}

export type StatusEvent = AgentProgressEvent | FeedProgressEvent
```

### 3.6 `src/types/tinyfish.ts`

```typescript
import { z } from "zod"

export const TinyFishSSEEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("STARTED"), run_id: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("STREAMING_URL"), run_id: z.string(), streaming_url: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("PROGRESS"), run_id: z.string(), purpose: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("COMPLETE"), run_id: z.string(), status: z.string(), result: z.unknown(), error: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("HEARTBEAT"), timestamp: z.string() })
])

export type TinyFishSSEEvent = z.infer<typeof TinyFishSSEEventSchema>
```

### 3.7 `src/types/constants.ts`

```typescript
export const STORAGE_KEYS = {
  VAULT: "vault:encrypted",
  BOOK_PREFIX: "books:",
  BOOK_INDEX: "books:index",
  AGENT_RUN_PREFIX: "agent-runs:",
  AGENT_RUN_INDEX: "agent-runs:index"
} as const

export const KNOWN_DATA_BROKERS = [
  "spokeo.com", "whitepages.com", "beenverified.com",
  "intelius.com", "mylife.com", "radaris.com",
  "truepeoplesearch.com", "fastpeoplesearch.com",
  "thatsthem.com", "publicrecords.com"
] as const

export const PORT_NAMES = {
  AGENT_STATUS: "agent-status"
} as const
```

---

## Phase 4: Utility Module Signatures (Integration Contracts)

### 4.1 `src/utils/tinyfish.ts`

```typescript
import { TinyFish } from "@tiny-fish/sdk"

export interface TinyFishRunOptions {
  url: string
  goal: string
  browserProfile?: "lite" | "stealth"
  useVault?: boolean
  credentialItemIds?: string[]
  proxyConfig?: {
    enabled: boolean
    countryCode?: "US" | "GB" | "CA" | "DE" | "FR" | "JP" | "AU"
  }
  onProgress?: (event: TinyFishSSEEvent) => void
}

export interface TinyFishResult {
  runId: string
  status: string
  result: unknown
  streamingUrl?: string
}

export async function runTinyFish(options: TinyFishRunOptions): Promise<TinyFishResult>
```

### 4.2 `src/utils/openai.ts`

```typescript
import type { ParsedPage, AgentAction } from "~types/agent"
import type { UserPersona } from "~types/persona"

// LLM A: Untrusted raw content -> Zod-validated structured JSON
// Model: gpt-4o-mini | Temperature: 0
export async function llmA_parse(
  rawContent: string,
  systemPrompt: string
): Promise<ParsedPage>

// LLM B: Clean validated JSON -> Action decisions
// Model: gpt-4o | Temperature: 0
// NEVER receives raw HTML — only Zod-validated ParsedPage
export async function llmB_decide(input: {
  parsedPage: ParsedPage
  persona?: Partial<UserPersona>
  goal: string
}): Promise<AgentAction[]>
```

### 4.3 `src/utils/tavily.ts`

```typescript
export interface ScoutResult {
  url: string
  title: string
  content: string
  score: number
}

export async function tavilyScout(options: {
  query: string
  includeDomains?: string[]
  excludeDomains?: string[]
  maxResults?: number
  searchDepth?: "basic" | "advanced"
}): Promise<ScoutResult[]>
```

### 4.4 `src/utils/session.ts`

```typescript
export async function extractCookies(
  domain: string
): Promise<Array<{ name: string; value: string }>>
```

### 4.5 `src/utils/crypto.ts`

```typescript
import type { EncryptedPayload } from "~types/vault"

const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_LENGTH_BITS = 256

async function deriveKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey>
export async function encrypt(plaintext: string, masterPassword: string): Promise<EncryptedPayload>
export async function decrypt(payload: EncryptedPayload, masterPassword: string): Promise<string>
```

---

## Phase 5: Logic Flows (Pseudocode)

### 5.1 Threat Sentry (Feed Generation / "The Library")

File: `src/agents/threat-sentry.ts`
Triggered by: `background/messages/start-feed.ts`

```
FUNCTION runThreatSentry(config: FeedConfig): Book
  1. CREATE Book { id: uuid(), status: "scouting", prompt: config.prompt, entries: [] }
  2. PERSIST Book to storage
  3. EMIT FeedProgressEvent { status: "scouting" }

  4. scoutResults = CALL tavilyScout({
       query: config.prompt,
       includeDomains: config.includeDomains,
       maxResults: config.maxResults,
       searchDepth: "advanced"
     })
  5. FILTER scoutResults where score > 0.5

  6. UPDATE Book status = "scraping"
  7. EMIT FeedProgressEvent { status: "scraping" }

  8. FOR EACH result in filteredResults:
       a. tfResult = CALL runTinyFish({
            url: result.url,
            goal: "Extract the full article/post content, author, date, and any CVE identifiers. Return as structured text.",
            browserProfile: config.browserProfile,
            onProgress: (evt) => EMIT FeedProgressEvent
          })
       b. rawContent = tfResult.result

  9. UPDATE Book status = "parsing"
  10. FOR EACH rawContent:
       a. parsed = CALL llmA_parse(rawContent, THREAT_SENTRY_SYSTEM_PROMPT)
       b. TRY validate with BookEntrySchema
       c. ON failure -> log warning, skip
       d. ON success -> push to Book.entries

  11. UPDATE Book { status: "done", lastUpdated: now() }
  12. PERSIST Book
  13. EMIT FeedProgressEvent { status: "done", entriesCount: entries.length }
  14. RETURN Book
```

### 5.2 Digital Ghost (Data Broker Opt-Out / "The Librarian")

File: `src/agents/digital-ghost.ts`
Triggered by: `background/messages/start-agent.ts`

```
FUNCTION runDigitalGhost(goal: string, persona: UserPersona): AgentRun
  1. CREATE AgentRun { id: uuid(), agentType: "digital-ghost", status: "running", steps: [] }

  2. SCOUT PHASE:
     a. CALL tavilyScout({
          query: `${persona.firstName} ${persona.lastName} data broker opt-out removal`,
          includeDomains: KNOWN_DATA_BROKERS,
          maxResults: 10
        })
     b. COLLECT targetUrls from results

  3. FOR EACH targetUrl:
     a. NAVIGATE: tfResult = CALL runTinyFish({
          url: targetUrl,
          goal: "Find the opt-out or data removal page. Navigate to it. Extract the full HTML of the opt-out form.",
          browserProfile: "stealth"
        })

     b. PARSE (Clean Room LLM A):
        parsedPage = CALL llmA_parse(tfResult.result, FORM_PARSE_PROMPT)
        VALIDATE with ParsedPageSchema

     c. DECIDE (Clean Room LLM B):
        actions = CALL llmB_decide({
          parsedPage,
          persona: { firstName, lastName, email, address },
          goal: "Fill the opt-out form to request data removal"
        })
        VALIDATE each with AgentActionSchema

     d. HITL GATE:
        IF any action.type === "submit_form":
          UPDATE AgentRun status = "paused_hitl"
          EMIT AgentProgressEvent with parsedPage + proposed actions
          AWAIT user response from agent-hitl-response handler
          IF approved:
            merge user modifications into actions
            CALL runTinyFish({
              url: targetUrl,
              goal: `Fill and submit: ${JSON.stringify(actions)}`,
              browserProfile: "stealth"
            })
          ELSE: log rejection, CONTINUE to next broker

  4. UPDATE AgentRun status = "completed"
  5. PERSIST run history
  6. RETURN AgentRun
```

### 5.3 Career Agent (Auto-Apply / "The Librarian")

File: `src/agents/career-agent.ts`
Triggered by: `background/messages/start-agent.ts`

```
FUNCTION runCareerAgent(goal: string, targetUrl: string | null, persona: UserPersona): AgentRun
  1. CREATE AgentRun { id: uuid(), agentType: "career-agent", status: "running" }

  2. SCOUT PHASE (if no targetUrl provided):
     a. results = CALL tavilyScout({
          query: goal,
          maxResults: 5
        })
     b. SELECT targetUrl = best match (prefer workday, lever, greenhouse domains)

  3. AUTHENTICATE VIA TINYFISH VAULT:
     a. Look up credentialItemId for this domain from user's stored credential mappings
     b. If credentials exist -> set useVault=true, credentialItemIds=[credentialItemId]
     c. If no credentials stored -> proceed without auth (public job boards)

  4. NAVIGATE:
     tfResult = CALL runTinyFish({
       url: targetUrl,
       goal: "Navigate to the job application form. If login is required and no credentials provided, report it. Otherwise extract the full form HTML.",
       browserProfile: "stealth",
       useVault: hasCredentials,
       credentialItemIds: hasCredentials ? [credentialItemId] : undefined
     })

  5. PARSE (Clean Room LLM A):
     parsedPage = CALL llmA_parse(tfResult.result, JOB_FORM_PARSE_PROMPT)
     VALIDATE with ParsedPageSchema

  6. MAP PERSONA -> FORM (Clean Room LLM B):
     actions = CALL llmB_decide({
       parsedPage,
       persona,
       goal: "Map persona data to each form field. For OPTIONAL_SENSITIVE fields, use 'Prefer not to answer'. Return fill_field actions."
     })
     VALIDATE each with AgentActionSchema

  7. HITL GATE:
     UPDATE AgentRun status = "paused_hitl"
     EMIT AgentProgressEvent with full field mapping preview
     AWAIT user approval
     IF approved:
       CALL runTinyFish({
         url: targetUrl,
         goal: `Fill and submit application: ${JSON.stringify(actions)}`,
         browserProfile: "stealth"
       })
     ELSE: CANCEL run

  8. UPDATE AgentRun status = "completed"
  9. RETURN AgentRun
```

---

## Phase 6: Security — Vault Lifecycle

### State Machine

```
uninitialized --[init(password, persona)]--> unlocked
unlocked      --[lock()]-----------------> locked
locked        --[unlock(password)]-------> unlocked
```

### Background Handler: `src/background/messages/vault-op.ts`

```
// Module-level closure (lives as long as service worker)
let cachedMasterPassword: string | null = null

HANDLER vault-op(req: VaultOpRequest): VaultOpResponse

  CASE "init":
    1. Validate persona with UserPersonaSchema
    2. json = JSON.stringify(persona)
    3. payload = await encrypt(json, masterPassword)
    4. Store payload to chrome.storage.local under STORAGE_KEYS.VAULT
    5. cachedMasterPassword = masterPassword
    6. RETURN { state: "unlocked" }

  CASE "unlock":
    1. Load payload from storage
    2. TRY await decrypt(payload, masterPassword)
    3. ON DOMException -> RETURN { state: "locked", error: "Wrong password" }
    4. cachedMasterPassword = masterPassword
    5. RETURN { state: "unlocked" }

  CASE "lock":
    1. cachedMasterPassword = null
    2. RETURN { state: "locked" }

  CASE "get-persona":
    1. IF cachedMasterPassword === null -> RETURN { state: "locked", error: "Vault is locked" }
    2. Load + decrypt payload
    3. Parse JSON, validate with UserPersonaSchema
    4. RETURN { state: "unlocked", persona }

  CASE "save-persona":
    1. IF cachedMasterPassword === null -> RETURN { state: "locked", error: "Vault is locked" }
    2. Validate persona
    3. Re-encrypt + overwrite storage
    4. RETURN { state: "unlocked" }
```

> **Note:** `cachedMasterPassword` lives in a closure variable. It dies when the service worker goes idle (~5 min). User must re-unlock. This is acceptable for the hackathon and actually adds security.

---

## Phase 7: Plasmo Messaging Wiring

All message handlers use `@plasmohq/messaging` conventions:

### Handler pattern (e.g., `src/background/messages/start-feed.ts`):

```typescript
import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { StartFeedRequest, StartFeedResponse } from "~types/messages"

const handler: PlasmoMessaging.MessageHandler<StartFeedRequest, StartFeedResponse> = async (req, res) => {
  const { config } = req.body
  // ... orchestrate feed generation ...
  res.send({ bookId })
}

export default handler
```

### Caller pattern (from popup):

```typescript
import { sendToBackground } from "@plasmohq/messaging"
import type { StartFeedRequest, StartFeedResponse } from "~types/messages"

const resp = await sendToBackground<StartFeedRequest, StartFeedResponse>({
  name: "start-feed",
  body: { config }
})
```

### Port pattern for push events (`src/background/ports/agent-status.ts`):

```typescript
import type { PlasmoMessaging } from "@plasmohq/messaging"

const handler: PlasmoMessaging.PortHandler = async (req, res) => {
  // Port stays open — background pushes events through it
}

export default handler
```

### Port consumer in React (popup components):

```typescript
import { usePort } from "@plasmohq/messaging/hook"

function AgentPanel() {
  const statusPort = usePort("agent-status")
  // statusPort.data contains the latest StatusEvent pushed from background
}
```

---

## Phase 8: Speedreader Implementation

File: `src/tabs/reader.tsx`

```
1. Read URL params: bookId, entryId from window.location.search
2. Load Book from chrome.storage.local using STORAGE_KEYS.BOOK_PREFIX + bookId
3. Find entry by entryId in Book.entries
4. Render entry.content (markdown) inside a <div className="prose prose-lg">
5. Display entry.title as <h1>, entry.sourceUrl as a link, entry.scrapedAt as date
6. Style: dark mode support, clean typography, minimal chrome — like Brave Speedreader
```

Opening from BookshelfView:
```typescript
chrome.tabs.create({
  url: chrome.runtime.getURL(`tabs/reader.html?bookId=${book.id}&entryId=${entry.id}`)
})
```

---

## Phase 9: HITL (Human-in-the-Loop) Implementation

The HITL gate uses a Promise resolver pattern in the background:

```typescript
const hitlResolvers = new Map<string, (response: { approved: boolean; modifications?: Record<string, string> }) => void>()

export function waitForHITL(runId: string): Promise<{ approved: boolean; modifications?: Record<string, string> }> {
  return new Promise((resolve) => {
    hitlResolvers.set(runId, resolve)
  })
}

export function resolveHITL(runId: string, response: { approved: boolean; modifications?: Record<string, string> }) {
  hitlResolvers.get(runId)?.(response)
  hitlResolvers.delete(runId)
}
```

- Agent flows call `await waitForHITL(runId)` at the gate
- `agent-hitl-response` handler calls `resolveHITL(runId, ...)`
- UI shows `HITLPreview.tsx` with editable form fields + Approve/Reject buttons

---

## Phase 10: Team Division

### Person A — Frontend (Popup, Bookshelf, Speedreader, HITL UI)

| File | Description |
|------|-------------|
| `src/popup/index.tsx` | Main popup with tab nav: Bookshelf \| Agent \| Vault |
| `src/tabs/reader.tsx` | Speedreader: renders Book entry as clean article |
| `src/components/BookshelfView.tsx` | Lists Books, click entry to open Speedreader |
| `src/components/BookCard.tsx` | Book summary card with status badge |
| `src/components/AgentPanel.tsx` | Agent start form, live status stream |
| `src/components/HITLPreview.tsx` | Editable form preview, Approve/Reject buttons |
| `src/components/VaultPanel.tsx` | Master password input, lock/unlock |
| `src/components/PersonaForm.tsx` | Multi-section persona editor |
| `src/components/PromptInput.tsx` | NL input bar + "Generate Feed" button |
| `src/components/StatusBadge.tsx` | Colored status indicator |
| `src/store/bookshelf.ts` | Zustand: books[], CRUD, loadFromStorage |
| `src/store/agent.ts` | Zustand: currentRun, hitlPending, hitlData |
| `src/store/vault.ts` | Zustand: vaultState, persona, unlock/lock |
| `src/style.css` | Tailwind directives |

**Integrates with Person B via:**
- `sendToBackground({ name: "start-feed", body: { config } })` -> `StartFeedRequest`
- `usePort("agent-status")` -> receives `FeedProgressEvent` / `AgentProgressEvent`

**Integrates with Person C via:**
- `sendToBackground({ name: "vault-op", body: {...} })` -> `VaultOpRequest`
- `sendToBackground({ name: "start-agent", body: {...} })` -> `StartAgentRequest`
- `sendToBackground({ name: "agent-hitl-response", body: {...} })` -> `AgentHITLResponseRequest`

---

### Person B — Engine (TinyFish, Tavily, OpenAI Clean Room, Feed Pipeline)

| File | Description |
|------|-------------|
| `src/background/index.ts` | Service worker entry point |
| `src/background/messages/start-feed.ts` | Validates FeedConfig, runs threat-sentry pipeline |
| `src/background/messages/get-cookies.ts` | chrome.cookies.getAll wrapper |
| `src/background/ports/agent-status.ts` | Port for pushing progress events to UI |
| `src/utils/tinyfish.ts` | TinyFish SDK wrapper with SSE event handling |
| `src/utils/openai.ts` | Dual-LLM clean room: llmA_parse + llmB_decide |
| `src/utils/tavily.ts` | Tavily scout wrapper |
| `src/utils/session.ts` | Cookie extraction utility |
| `src/agents/threat-sentry.ts` | Feed pipeline (Section 5.1) |
| `src/types/tinyfish.ts` | TinyFish SSE event types |

**Integrates with Person A via:**
- Responds to `start-feed` messages with `StartFeedResponse`
- Pushes `FeedProgressEvent` through `agent-status` port

**Integrates with Person C via:**
- Exports `runTinyFish`, `llmA_parse`, `llmB_decide`, `tavilyScout`, `extractCookies`
- Person C imports these directly in agent flows

---

### Person C — Librarian Agents + Vault + Schemas

| File | Description |
|------|-------------|
| `src/types/book.ts` | Book, BookEntry, FeedConfig schemas |
| `src/types/vault.ts` | EncryptedPayload, VaultState schemas |
| `src/types/persona.ts` | UserPersona schema |
| `src/types/agent.ts` | AgentAction, AgentStep, AgentRun, ParsedPage schemas |
| `src/types/messages.ts` | All message type definitions |
| `src/types/constants.ts` | Storage keys, known data brokers, port names |
| `src/utils/crypto.ts` | PBKDF2 + AES-256-GCM vault crypto |
| `src/agents/digital-ghost.ts` | Digital Ghost flow (Section 5.2) |
| `src/agents/career-agent.ts` | Career Agent flow (Section 5.3) |
| `src/background/messages/start-agent.ts` | Routes to correct agent, manages lifecycle |
| `src/background/messages/agent-hitl-response.ts` | Resolves HITL promise |
| `src/background/messages/vault-op.ts` | Vault state machine |

**CRITICAL: Person C creates ALL `src/types/*.ts` files FIRST** (Hour 0-1) since they are the integration contracts.

---

## Phase 11: Build Timeline

| Time | Person A (Frontend) | Person B (Engine) | Person C (Agents + Vault) |
|------|-------------------|-------------------|--------------------------|
| **H0-1** | Clone repo, verify `pnpm dev` loads | Run init commands, push skeleton | Create ALL `src/types/*.ts` files, push |
| **H1-3** | Popup shell with 3 tabs, BookshelfView with mock data, PromptInput | `tinyfish.ts`, `openai.ts`, `tavily.ts`, `session.ts` | `crypto.ts`, `vault-op.ts` handler, test encrypt/decrypt |
| **H3-5** | VaultPanel + PersonaForm, AgentPanel UI | `background/index.ts`, `start-feed.ts`, `threat-sentry.ts` | `digital-ghost.ts`, `start-agent.ts`, `agent-hitl-response.ts` |
| **H5-7** | Connect popup to background via `sendToBackground`, Speedreader tab | Wire threat-sentry end-to-end with real APIs | Wire digital-ghost end-to-end, `career-agent.ts` |
| **H7-8** | HITLPreview component, agent-status port listener | Test + debug feed pipeline | Test + debug agent flows with HITL |
| **H8-9** | Polish UI, dark mode, error states | Integration testing all 3 flows | Integration testing, fallback data |
| **H9** | Record fallback demo video | Help with integration | Help with integration |

---

## Phase 12: Verification

### How to test end-to-end:

1. **Build & Load:**
   ```bash
   pnpm dev  # or pnpm build for production
   ```
   Load `build/chrome-mv3-dev` in Chrome via `chrome://extensions` (dev mode).
   For Firefox: `pnpm dev --target=firefox-mv2`, load from `build/firefox-mv2-dev`.

2. **Test Vault:**
   - Open popup -> Vault tab -> Set master password -> Save persona
   - Lock -> Unlock -> Verify persona persists
   - Close/reopen browser -> Verify vault is locked (service worker died)

3. **Test Threat Sentry:**
   - Open popup -> Bookshelf tab -> Enter NL prompt (e.g., "latest zero-day CVEs 2026")
   - Verify: scouting -> scraping -> parsing -> done status progression
   - Click an entry -> Speedreader tab opens with formatted article

4. **Test Digital Ghost:**
   - Open popup -> Agent tab -> Select "Digital Ghost"
   - Enter goal: "Remove my data from data brokers"
   - Verify: scout phase finds brokers -> navigates -> parses form -> HITL preview appears
   - Approve or reject -> verify agent proceeds or stops

5. **Test Career Agent:**
   - Open popup -> Agent tab -> Select "Career Agent"
   - Enter goal + target URL (a public job listing)
   - Verify: form parsed -> persona mapped to fields -> HITL preview with editable values
   - Approve -> verify submission attempt

---

## Phase 13: Fallback / Risk Mitigation

| Risk | Mitigation |
|------|------------|
| TinyFish API slow/down | Pre-record TinyFish portions; stub `runTinyFish` with canned results |
| TinyFish vault creds not set up for target site | Demo Career Agent on public job boards (no login needed), or pre-configure TinyFish vault creds before demo |
| PBKDF2 600k iterations slow on weak machines | Reduce to 100k for demo, add comment noting production value |
| LLM A returns invalid JSON | Wrap in try/catch, retry once with stricter prompt, then skip entry |
| Plasmo hot-reload breaks background worker | `pnpm build` and test from `build/` directly |
| OpenAI rate limits during demo | Cache LLM responses in chrome.storage for repeated demo runs |
