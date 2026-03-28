import type { FeedTemplate } from "./types"

const news: FeedTemplate = {
  id: "news",
  name: "News & Articles",

  triggerKeywords: [
    "news",
    "article",
    "breaking news",
    "headline",
    "press release",
    "news coverage",
    "news story",
    "current events",
    "media report",
    "news update"
  ],

  tinyfishGoal: `Extract the following fields from this article page and return as JSON:
{
  "title": "full article headline",
  "author": "author name or null",
  "publishedDate": "publication date as written on the page, or null",
  "source": "publication or outlet name, or null",
  "category": "article category or section (e.g. Politics, Tech, Sports), or null",
  "body": "complete article body text, preserving paragraph breaks"
}
Do not summarize. Extract verbatim content only.`,

  parseSystemPrompt: `You receive raw extracted article data as JSON. Format it into a clean Chapter.

Return ONLY valid JSON:
{
  "title": "<article headline>",
  "content": "<formatted markdown>",
  "metadata": {
    "author": "<author or null>",
    "publishedDate": "<date or null>",
    "source": "<source or null>",
    "category": "<category or null>"
  }
}

For content, use this structure:
**Source:** [source] | **Author:** [author] | **Published:** [publishedDate]

---

[body — full article text verbatim, preserving all paragraphs and formatting]

Rules:
- If a field is null or missing, omit that metadata entry from the header line but still include it as null in the metadata object
- Do not add your own commentary or summaries
- Keep the full body text intact`
}

export default news
