import type { FeedTemplate } from "./types"

const geopolitics: FeedTemplate = {
  id: "geopolitics",
  name: "Geopolitics & Conflicts",

  triggerKeywords: [
    "geopolitics",
    "geopolitical",
    "diplomatic",
    "diplomacy",
    "foreign policy",
    "international relations",
    "armed conflict",
    "military operation",
    "sanctions",
    "territorial dispute",
    "nato",
    "united nations",
    "peace talks",
    "ceasefire",
    "treaty",
    "annexation",
    "sovereignty",
    "regime change",
    "proxy war",
    "defense pact",
    "war in",
    "conflict in"
  ],

  tinyfishGoal: `Extract the following geopolitical event fields from this page and return as JSON:
{
  "headline": "article headline or event title",
  "eventDate": "date of the event or publication date, or null",
  "region": "geographic region or country involved",
  "actors": "key actors, nations, or organizations involved",
  "eventType": "type of event (e.g. Armed Conflict, Diplomacy, Sanctions, Treaty, Military Operation)",
  "summary": "brief one-line summary of the event",
  "body": "complete article/analysis text preserving all detail, quotes, and context",
  "implications": "stated implications or analysis from the article, or null",
  "source": "publication or outlet name"
}
Extract verbatim. Do not summarize the body.`,

  parseSystemPrompt: `You receive raw extracted geopolitical event data as JSON. Format it into a structured Chapter.

Return ONLY valid JSON:
{
  "title": "<headline>",
  "content": "<formatted markdown>",
  "metadata": {
    "region": "<region or null>",
    "actors": "<actors or null>",
    "eventType": "<event type or null>",
    "eventDate": "<date or null>",
    "source": "<source or null>"
  }
}

For content, use this exact structure:
**Region:** [region] | **Date:** [eventDate] | **Type:** [eventType]
**Key Actors:** [actors] | **Source:** [source]

---

[body — full article/analysis text verbatim, preserving all detail, quotes, and context]

Rules:
- Preserve all quotes, attributions, and factual claims exactly
- Do not editorialize or add your own analysis
- If a field is null, omit it from the header line but include null in metadata`
}

export default geopolitics
