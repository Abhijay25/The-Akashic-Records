# The Akashic Records

A Personal Agentic Browser (PAB) extension that reads, curates, and acts on the web — so you don't have to.

Built for the [TinyFish $2M Pre-Accelerator Hackathon](https://tinyfish.io) — March 2026.

---

## What It Does

The Akashic Records has two core capabilities:

### 📚 The Library — Intelligence Feed Pipeline
Turn any natural language prompt into a curated, structured feed. The Library scouts the web, extracts full content, and formats it into clean readable **Books** made up of **Chapters** — all in your browser, no account needed.

### 🤖 The Librarian — Agentic Execution Engine
An agent that acts on the web on your behalf. First use case: automated job applications. Provide your resume once, and the Librarian fills ATS forms (Workday, Greenhouse, Lever, etc.) using your encrypted persona profile — pausing before every submission for your approval.

---

## Key Concepts

| Term | Meaning |
|------|---------|
| **Book** | A curated collection of web content generated from a single prompt |
| **Chapter** | A single parsed entry within a Book (article, CVE, job posting, etc.) |
| **Persona** | Your structured profile (parsed from your resume) — AES-256-GCM encrypted at rest |
| **HITL Gate** | Human-in-the-Loop pause before any form is submitted — you review and approve |
| **Vault** | Local encrypted storage for your Persona — zero-knowledge, passphrase-protected |

---

## The Library — Content Templates

The Library auto-detects the type of content you're looking for and applies the right extraction strategy. 7 templates ship out of the box:

| Template | Prompt examples | What it extracts |
|----------|----------------|-----------------|
| `news` | "latest AI news", "breaking tech headlines" | Full article text, author, date, source |
| `cve` | "critical CVEs this week", "zero-days in Chrome" | CVE ID, CVSS score, affected products, remediation |
| `job-posting` | "SWE internships Singapore", "ML engineer roles" | Title, company, salary, requirements, apply URL |
| `market-data` | "Bitcoin price", "S&P 500 today" | Price, change %, volume, 52-week range |
| `financial-analysis` | "analyst forecasts for NVDA", "earnings estimates" | Rating, price target, analyst, time horizon |
| `product-release` | "React 20 release notes", "new iPhone features" | Version, changelog, highlights, availability |
| `geopolitics` | "conflict in Ukraine", "US-China trade war" | Region, actors, event type, full reporting |

---

## The Librarian — Job Application Flow

### One-time setup
1. Paste your resume text + email → GPT-4o-mini parses it into a structured `UserPersona`
2. Create a passphrase → Persona encrypted with AES-256-GCM and stored locally
3. Done — your profile is ready for all future applications

### Two input modes

**Mode A — Ad-Hoc Prompt**
```
"SWE internship Singapore"
  → Tavily scouts LinkedIn job listings
  → TinyFish visits each page, extracts the external ATS "Apply" URL
  → Blacklist filter (removes gov portals, Singpass, etc.)
  → TinyFish STEALTH fills each ATS form using your Persona
  → Pipeline pauses — you review and approve
  → TinyFish clicks Submit on approved applications
```

**Mode B — Feed Batch**
```
Pre-validated ATS URLs (e.g. from a job feed Book)
  → Blacklist filter
  → TinyFish STEALTH fills each form
  → Pipeline pauses — you review and approve
  → TinyFish clicks Submit on approved applications
```

### What the agent handles automatically
- Multi-page/multi-step ATS forms
- Legal & compliance questions (always selects the safest option — "No" for criminal history, "Prefer not to say" for disability/veteran status, etc.)
- Short-answer and cover letter fields — GPT-4o-mini generates professional responses tailored to the role
- Dropdown fields with no exact match — picks the closest reasonable option

### What it never does without you
- Click Submit — always pauses at `awaiting_approval` for your review
- Apply to blacklisted domains (government portals, Singpass)
- Send any data to a cloud server — everything is local

---

## Planned

- **Settings menu** — manage named credential accounts (Google, LinkedIn, etc.) and update your resume; all stored in the same local encrypted vault
- **Digital Ghost** — automated data broker opt-out requests across 10+ brokers

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                      Popup UI                        │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  Bookshelf   │  │ Librarian  │  │  Settings   │  │
│  │  + Reader    │  │  + HITL    │  │  + Vault    │  │
│  └──────┬───────┘  └─────┬──────┘  └──────┬──────┘  │
└─────────┼────────────────┼────────────────┼─────────┘
          │         sendToBackground()       │
┌─────────▼────────────────▼────────────────▼─────────┐
│                Background Service Worker              │
│  ┌────────────┐  ┌─────────────────┐  ┌──────────┐  │
│  │ start-feed │  │ start-librarian │  │  setup-  │  │
│  │            │  │ approve-submit  │  │  persona │  │
│  └─────┬──────┘  └───────┬─────────┘  └────┬─────┘  │
│        │                 │                  │        │
│  ┌─────▼─────────────────▼──────────────────▼──────┐ │
│  │          threat-sentry  |  librarian             │ │
│  └─────┬─────────────────────────────┬─────────────┘ │
└────────┼─────────────────────────────┼───────────────┘
         │                             │
┌────────▼───┐   ┌────────────────┐   ┌▼───────────┐
│   Tavily   │   │   TinyFish     │   │   OpenAI   │
│  (Scout)   │   │  LITE / STEALTH│   │ GPT-4o-mini│
└────────────┘   └────────────────┘   └────────────┘
```

---

## Security Model

1. **Zero-knowledge vault** — Persona encrypted with AES-256-GCM. Key derived via PBKDF2 (SHA-256, 600,000 iterations, random 16-byte salt). Passphrase never stored — derived fresh on each access and discarded immediately after.
2. **Local-only storage** — all data lives in `chrome.storage.local`. Nothing is sent to any server.
3. **HITL before every submission** — the agent fills forms but never clicks Submit without your explicit approval.
4. **Blacklist guard** — government and SSO portals blocked at two layers (orchestrator + executor).
5. **Sequential execution** — forms filled one at a time to avoid rate-limiting and detection.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Plasmo](https://plasmo.com) (Chrome MV3) |
| Language | TypeScript |
| Schemas | Zod (runtime validation on all cross-boundary data) |
| State | Zustand + `@plasmohq/storage` |
| Messaging | `@plasmohq/messaging` (type-safe background handlers + ports) |
| Browsing | [TinyFish SDK](https://tinyfish.io) — LITE (extract) and STEALTH (act) profiles |
| Search | [Tavily API](https://tavily.com) — AI-optimized web search |
| LLM | OpenAI GPT-4o-mini (keyword extraction, content parsing, resume parsing, short-answer generation) |
| Encryption | PBKDF2 + AES-256-GCM via Web Crypto API (no external crypto libraries) |
| Styling | Tailwind CSS + `@tailwindcss/typography` |

---

## Project Structure

```
src/
├── agents/
│   ├── threat-sentry.ts     # Library pipeline orchestrator
│   └── librarian.ts         # Librarian execution engine
├── background/
│   ├── index.ts             # Service worker entry
│   ├── messages/            # start-feed, start-librarian, setup-persona, approve-submit
│   └── ports/               # agent-status (push events → popup)
├── templates/               # 7 content templates (news, cve, job-posting, etc.)
├── types/                   # Zod schemas: book, librarian, messages, constants
├── utils/
│   ├── openai.ts            # Keyword extraction + content parsing
│   ├── tavily.ts            # Web search
│   ├── tinyfish.ts          # Content extraction (LITE)
│   ├── tinyfish-execute.ts  # Form-filling + submission (STEALTH)
│   ├── vault.ts             # AES-256-GCM encrypted persona storage
│   ├── blacklist.ts         # URL domain blacklist filter
│   └── resume-parser.ts     # Resume text → UserPersona (GPT-4o-mini)
├── popup/index.tsx          # Main popup UI
└── tabs/reader.tsx          # Speedreader view
```

---

## Setup

```bash
# Clone and install
git clone <repo-url>
cd the-akashic-records
pnpm install

# Configure API keys — create a .env.local file:
PLASMO_PUBLIC_OPENAI_API_KEY=sk-...
PLASMO_PUBLIC_TINYFISH_API_KEY=tf-...
PLASMO_PUBLIC_TAVILY_API_KEY=tvly-...

# Development
pnpm dev

# Production build
pnpm build
```

Load the extension in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select `build/chrome-mv3-dev`

---

## License

MIT
