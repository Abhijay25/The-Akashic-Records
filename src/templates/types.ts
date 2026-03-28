/**
 * A FeedTemplate defines how to extract and format content for a specific
 * category of web content (news, CVEs, job postings, etc.).
 *
 * To add a new template:
 *   1. Create src/templates/<name>.ts implementing FeedTemplate
 *   2. Register it in src/templates/index.ts
 */
export interface FeedTemplate {
  /** Unique identifier — stored on Book for downstream rendering */
  id: string

  /** Human-readable label shown in the UI */
  name: string

  /**
   * Keywords that, when found in the user's prompt, suggest this template.
   * detectTemplate() picks the template with the most keyword hits.
   */
  triggerKeywords: string[]

  /**
   * Instruction passed to TinyFish's browser agent.
   * Should describe exactly what fields to extract and in what JSON shape.
   * TinyFish returns Record<string, unknown> — this shapes that output.
   */
  tinyfishGoal: string

  /**
   * System prompt for GPT-4o-mini (LLM A).
   * Receives the TinyFish JSON result as user message.
   * Must return a JSON object with:
   *   { title: string, content: string (markdown) }
   * content will be stored as Chapter.content and rendered in Speedreader.
   */
  parseSystemPrompt: string
}
