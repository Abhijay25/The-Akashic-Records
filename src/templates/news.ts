import type { FeedTemplate } from "./types"

const news: FeedTemplate = {
  id: "news",
  name: "News & Articles",

  triggerKeywords: [
    "news",
    "article",
    "latest",
    "update",
    "report",
    "breaking",
    "today",
    "headline",
    "story",
    "coverage"
  ],

  tinyfishGoal: `Extract the following fields from this article page and return as JSON:
{
  "title": "full article headline",
  "author": "author name or null",
  "publishedDate": "publication date as written on the page, or null",
  "source": "publication or outlet name, or null",
  "body": "complete article body text, preserving paragraph breaks"
}
Do not summarize. Extract verbatim content only.`,

  parseSystemPrompt: `You receive raw extracted article data as JSON. Format it into a clean Chapter.

Return ONLY valid JSON:
{
  "title": "<article headline>",
  "content": "<formatted markdown>"
}

For content, use this structure:
**Source:** [source] | **Author:** [author] | **Published:** [date]

[article body — preserve paragraphs, use markdown formatting for any lists or emphasis found in the text]

Rules:
- If a field is null or missing, omit that metadata line entirely
- Do not add your own commentary or summaries
- Keep the full body text intact`
}

export default news
