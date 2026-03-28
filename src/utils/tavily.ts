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
  maxResults = 5,
  timeoutMs = 20_000
}: {
  query: string
  maxResults?: number
  timeoutMs?: number
}): Promise<ScoutResult[]> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Tavily search timed out after ${timeoutMs}ms`)), timeoutMs)
  )
  const response = await Promise.race([
    client.search(query, { searchDepth: "advanced", maxResults, includeAnswer: false }),
    timeout,
  ])

  return (response.results ?? [])
    .filter((r) => r.score >= 0.5)
    .map((r) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      score: r.score
    }))
}
