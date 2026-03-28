import type { FeedTemplate } from "./types"
import news from "./news"
import cve from "./cve"
import jobPosting from "./job-posting"

export type { FeedTemplate }

/**
 * All registered templates. To add a new one:
 *   1. Create src/templates/<name>.ts
 *   2. Import it here and add to this array
 */
export const TEMPLATES: FeedTemplate[] = [cve, jobPosting, news]

/**
 * Returns the template whose trigger keywords best match the user's prompt.
 * Scores by keyword hit count; ties broken by array order (cve > job-posting > news).
 * Falls back to `news` if no keywords match.
 */
export function detectTemplate(prompt: string): FeedTemplate {
  const lower = prompt.toLowerCase()

  let best: FeedTemplate = news
  let bestScore = 0

  for (const template of TEMPLATES) {
    const score = template.triggerKeywords.filter((kw) =>
      lower.includes(kw.toLowerCase())
    ).length

    if (score > bestScore) {
      bestScore = score
      best = template
    }
  }

  return best
}

/**
 * Looks up a template by ID. Falls back to `news` if not found.
 */
export function getTemplate(id: string): FeedTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? news
}
