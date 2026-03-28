import type { FeedTemplate } from "./types"
import news from "./news"
import cve from "./cve"
import jobPosting from "./job-posting"
import marketData from "./market-data"
import financialAnalysis from "./financial-analysis"
import productRelease from "./product-release"
import geopolitics from "./geopolitics"

export type { FeedTemplate }

/**
 * All registered templates, ordered most-specific-first for detection priority.
 * Ties in keyword score are broken by array position — earlier wins.
 * `news` is last as the catch-all fallback.
 */
export const TEMPLATES: FeedTemplate[] = [
  cve,
  marketData,
  financialAnalysis,
  productRelease,
  geopolitics,
  jobPosting,
  news
]

/**
 * Returns the template whose trigger keywords best match the user's prompt.
 * Scores by keyword hit count; ties broken by array order.
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
