import { tavily } from "@tavily/core"

export interface ScoutResult {
  url: string
  title: string
  content: string // snippet
  score: number
}

const client = tavily({ apiKey: process.env.PLASMO_PUBLIC_TAVILY_API_KEY ?? "" })

/**
 * Searches the web using Tavily and returns filtered, scored results.
 */
export async function tavilyScout({
  query,
  maxResults = 5
}: {
  query: string
  maxResults?: number
}): Promise<ScoutResult[]> {
  const response = await client.search(query, {
    searchDepth: "advanced",
    maxResults,
    includeAnswer: false
  })

  return (response.results ?? [])
    .filter((r) => r.score >= 0.5)
    .map((r) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      score: r.score
    }))
}
