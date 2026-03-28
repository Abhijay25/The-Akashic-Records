import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.PLASMO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

const KEYWORD_SYSTEM_PROMPT = `You are a search query generator. Given a natural language topic, produce 2-3 precise web search queries that would surface recent, authoritative content on that topic.

If the user mentions a specific platform or website, append the appropriate site: operator to ALL generated queries.
Common mappings:
- Reddit → site:reddit.com
- Twitter / X / tweets → site:twitter.com
- LinkedIn (posts/people, not jobs) → site:linkedin.com
- GitHub → site:github.com
- Hacker News / HN → site:news.ycombinator.com
- YouTube → site:youtube.com
- Stack Overflow → site:stackoverflow.com
- Product Hunt → site:producthunt.com

Example: "find Reddit posts about Rust async" →
{"queries": ["Rust async site:reddit.com", "Rust async runtime site:reddit.com"]}

Return ONLY a JSON object with a "queries" array of strings. Example:
{"queries": ["query one", "query two", "query three"]}`

/**
 * Converts a natural language prompt into 2-3 optimized search queries.
 */
export async function extractKeywords(prompt: string): Promise<string[]> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: KEYWORD_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3
  })

  const raw = completion.choices[0]?.message?.content ?? "{}"

  try {
    const parsed = JSON.parse(raw)
    const arr: unknown =
      parsed.queries ?? parsed.results ?? Object.values(parsed)[0]
    if (!Array.isArray(arr)) throw new Error("No array found")
    return arr.filter((q): q is string => typeof q === "string").slice(0, 3)
  } catch {
    console.warn("[openai] extractKeywords parse failed, using prompt as-is")
    return [prompt]
  }
}

/**
 * Parses raw TinyFish-extracted content into { title, content } using GPT-4o-mini.
 * systemPrompt comes from the active FeedTemplate.
 * Retries once with a stricter instruction on failure.
 * Returns null if both attempts fail — caller should use Tavily snippet as fallback.
 */
export async function llmA_parse(
  rawContent: string,
  systemPrompt: string
): Promise<string | null> {
  const attempt = async (strict: boolean): Promise<string | null> => {
    const sysMsg = strict
      ? systemPrompt +
        "\n\nCRITICAL: Return ONLY valid JSON with exactly three fields: title (string), content (string), and metadata (object). No extra keys, no prose outside the JSON."
      : systemPrompt

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sysMsg },
        // Truncate to stay within token limits while preserving the most useful content
        { role: "user", content: rawContent.slice(0, 8000) }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    })

    return completion.choices[0]?.message?.content ?? null
  }

  try {
    const result = await attempt(false)
    if (result) return result
  } catch (err) {
    console.warn("[openai] llmA_parse attempt 1 failed:", err)
  }

  try {
    return await attempt(true)
  } catch (err) {
    console.warn("[openai] llmA_parse attempt 2 failed:", err)
    return null
  }
}
