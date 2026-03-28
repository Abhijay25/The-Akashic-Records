import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.PLASMO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

const KEYWORD_SYSTEM_PROMPT = `You are a search query generator. Given a natural language topic, produce 2-3 precise web search queries that would surface recent, authoritative content on that topic.

Return ONLY a JSON array of strings. Example:
["query one", "query two", "query three"]`

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

  const raw = completion.choices[0]?.message?.content ?? "[]"

  try {
    const parsed = JSON.parse(raw)
    // Handle both {"queries": [...]} and direct arrays
    const arr = Array.isArray(parsed) ? parsed : (parsed.queries ?? parsed.results ?? Object.values(parsed)[0])
    if (!Array.isArray(arr)) throw new Error("No array found in response")
    return arr.filter((q): q is string => typeof q === "string").slice(0, 3)
  } catch {
    // Fallback: use the prompt itself as the query
    console.warn("[openai] extractKeywords parse failed, using prompt as-is")
    return [prompt]
  }
}

/**
 * Parses raw scraped content into a structured BookEntry using GPT-4o-mini.
 * Returns null on repeated failure so the caller can skip the entry.
 */
export async function llmA_parse(
  rawContent: string,
  systemPrompt: string
): Promise<string | null> {
  const attempt = async (strict: boolean): Promise<string | null> => {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: strict
            ? systemPrompt +
              "\n\nCRITICAL: Return ONLY valid JSON matching the schema. No extra text."
            : systemPrompt
        },
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
    const result = await attempt(true)
    return result
  } catch (err) {
    console.warn("[openai] llmA_parse attempt 2 failed:", err)
    return null
  }
}
