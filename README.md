# The Librarian

A Personal Agentic Browser (PAB) extension that automates high-level tasks on websites lacking APIs or with hostile interfaces.

Built for the [TinyFish $2M Pre-Accelerator Hackathon](https://tinyfish.io) — March 2026.

## What It Does

The Librarian is a browser extension with three agent capabilities:

| Agent | What it does | Category |
|-------|-------------|----------|
| **Threat Sentry** | Generates curated security intelligence feeds from forums and advisories | Security |
| **Digital Ghost** | Automates data broker opt-out/removal requests across 10+ brokers | Privacy |
| **Career Agent** | Auto-fills job applications using your stored persona profile | Productivity |

All agents use a **dual-LLM clean room** architecture:
- **LLM A** (GPT-4o-mini): Parses untrusted HTML into structured, validated JSON
- **LLM B** (GPT-4o): Makes action decisions using only clean, validated data

A **Human-in-the-Loop (HITL)** gate pauses before any form submission so you can review and edit before the agent acts.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Popup UI                       │
│  ┌───────────┐ ┌───────────┐ ┌────────────────┐│
│  │ Bookshelf │ │   Agent   │ │     Vault      ││
│  │  + Feed   │ │  + HITL   │ │  + Persona     ││
│  └─────┬─────┘ └─────┬─────┘ └──────┬─────────┘│
└────────┼──────────────┼──────────────┼──────────┘
         │   sendToBackground()        │
┌────────▼──────────────▼──────────────▼──────────┐
│              Background Service Worker           │
│  ┌──────────┐ ┌────────────┐ ┌────────────────┐ │
│  │start-feed│ │start-agent │ │   vault-op     │ │
│  └────┬─────┘ └─────┬──────┘ └───────┬────────┘ │
│       │              │                │          │
│  ┌────▼──────────────▼────────────────▼────────┐ │
│  │              Agent Flows                     │ │
│  │  threat-sentry | digital-ghost | career-agent│ │
│  └────┬───────────────┬────────────────────────┘ │
└───────┼───────────────┼─────────────────────────┘
        │               │
┌───────▼───┐   ┌───────▼───────┐   ┌────────────┐
│  Tavily   │   │   TinyFish    │   │  OpenAI    │
│  (Scout)  │   │  (Browse/Act) │   │ (Parse +   │
│           │   │               │   │  Decide)   │
└───────────┘   └───────────────┘   └────────────┘
```

## Key Concepts

- **Book**: A curated collection of web content entries, generated from a natural language prompt
- **Speedreader**: A clean, distraction-free reading view for Book entries (like Brave's Reader Mode)
- **Persona**: Your encrypted profile (name, education, work history, skills) stored in an AES-256-GCM vault
- **Clean Room**: LLM A never sees your persona data; LLM B never sees raw HTML — security by architecture
- **HITL Gate**: Every form submission requires your explicit approval with editable field preview

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Plasmo](https://plasmo.com) (MV3 + MV2) |
| Language | TypeScript |
| Schemas | Zod (runtime validation on all cross-boundary data) |
| State | Zustand + `@plasmohq/storage` |
| Messaging | `@plasmohq/messaging` (type-safe background handlers) |
| Browsing | [TinyFish SDK](https://tinyfish.io) (headless browser agent) |
| Search | [Tavily API](https://tavily.com) (AI-optimized web search) |
| LLMs | OpenAI GPT-4o-mini (parse) + GPT-4o (decide) |
| Encryption | PBKDF2 + AES-256-GCM via Web Crypto API |
| Styling | Tailwind CSS + `@tailwindcss/typography` |

## Setup

```bash
# Clone and install
git clone <repo-url>
cd the-librarian
pnpm install

# Configure API keys
cp .env.example .env
# Edit .env with your keys:
#   PLASMO_PUBLIC_OPENAI_API_KEY=sk-...
#   PLASMO_PUBLIC_TINYFISH_API_KEY=sk-tinyfish-...
#   PLASMO_PUBLIC_TAVILY_API_KEY=tvly-...

# Development
pnpm dev                        # Chrome MV3
pnpm dev --target=firefox-mv2   # Firefox MV2

# Production build
pnpm build
```

Load the extension:
- **Chrome**: `chrome://extensions` -> Developer Mode -> Load unpacked -> select `build/chrome-mv3-dev`
- **Firefox**: `about:debugging#/runtime/this-firefox` -> Load Temporary Add-on -> select any file in `build/firefox-mv2-dev`

## Project Structure

```
src/
├── popup/index.tsx          # Main popup (Bookshelf | Agent | Vault tabs)
├── tabs/reader.tsx          # Speedreader view
├── background/
│   ├── index.ts             # Service worker entry
│   ├── messages/            # Plasmo message handlers
│   └── ports/               # Plasmo port handlers (push events)
├── types/                   # Zod schemas (integration contracts)
├── utils/                   # API wrappers (TinyFish, OpenAI, Tavily, crypto)
├── agents/                  # Agent flow orchestration
├── store/                   # Zustand state stores
└── components/              # React UI components
```

## Security Model

1. **Vault encryption**: Persona data encrypted at rest with AES-256-GCM (PBKDF2 key derivation, 600K iterations)
2. **Service worker key caching**: Master password cached in a closure variable — dies when service worker idles (~5 min)
3. **Clean room LLM separation**: Raw HTML never reaches the decision-making LLM; persona data never reaches the parsing LLM
4. **HITL before submission**: No form is submitted without explicit user approval
5. **TinyFish vault for credentials**: Login credentials stored in TinyFish's managed vault, not in the extension

## Team

| Person | Role | Focus |
|--------|------|-------|
| A | Frontend | Popup UI, Bookshelf, Speedreader, HITL components |
| B | Engine | TinyFish/Tavily/OpenAI wrappers, feed pipeline |
| C | Agents + Vault | Zod schemas, crypto, agent flows, vault handler |

## License

MIT
