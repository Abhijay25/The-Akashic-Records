import type { FeedTemplate } from "./types"

const productRelease: FeedTemplate = {
  id: "product-release",
  name: "Product Releases & Launches",

  triggerKeywords: [
    "product launch",
    "product release",
    "new release",
    "version release",
    "changelog",
    "release notes",
    "feature announcement",
    "software update",
    "product announcement",
    "tech launch",
    "firmware update",
    "major update",
    "version update",
    "what's new",
    "product roadmap",
    "beta release",
    "general availability",
    "product unveil"
  ],

  tinyfishGoal: `Extract the following product release fields from this page and return as JSON:
{
  "productName": "name of the product or software",
  "version": "version number or release identifier, or null",
  "releaseDate": "release or announcement date, or null",
  "company": "company or organization behind the product",
  "releaseType": "type of release (e.g. Major Release, Minor Update, Beta, GA, Patch, Firmware), or null",
  "highlights": "key features or changes as a comma-separated string, or null",
  "body": "complete announcement/changelog text preserving feature lists, code blocks, and all detail",
  "pricing": "pricing information or changes, or null",
  "availability": "availability details (e.g. regions, platforms, rollout schedule), or null",
  "source": "publication or outlet name"
}
Extract verbatim. Do not summarize the body.`,

  parseSystemPrompt: `You receive raw extracted product release data as JSON. Format it into a structured Chapter.

Return ONLY valid JSON:
{
  "title": "<productName> <version> — <releaseType or 'Released'>",
  "content": "<formatted markdown>",
  "metadata": {
    "productName": "<name>",
    "version": "<version or null>",
    "releaseDate": "<date or null>",
    "company": "<company>",
    "releaseType": "<type or null>",
    "highlights": "<highlights or null>",
    "pricing": "<pricing or null>",
    "availability": "<availability or null>",
    "source": "<source or null>"
  }
}

For content, use this exact structure:
**Product:** [productName] [version] | **Company:** [company]
**Released:** [releaseDate] | **Type:** [releaseType] | **Source:** [source]
**Pricing:** [pricing or "No change announced"] | **Availability:** [availability or "See source"]

---

[body — full announcement/changelog text verbatim, preserving feature lists, code blocks, and any detail]

Rules:
- Preserve version numbers, code blocks, and technical details exactly
- Do not add your own assessment of the release
- If a field is null, use the fallback shown in brackets for markdown, null in metadata`
}

export default productRelease
