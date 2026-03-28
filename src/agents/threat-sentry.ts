import { v4 as uuidv4 } from "uuid"
import { Storage } from "@plasmohq/storage"
import { extractKeywords, llmA_parse } from "~utils/openai"
import { tavilyScout } from "~utils/tavily"
import { runTinyFish } from "~utils/tinyfish"
import { BookSchema, BookEntrySchema } from "~types/book"
import { STORAGE_KEYS } from "~types/constants"
import type { Book, BookEntry, FeedConfig } from "~types/book"
import type { FeedProgressEvent } from "~types/messages"

const storage = new Storage({ area: "local" })

const PARSE_SYSTEM_PROMPT = `You are a content structuring assistant. Given raw extracted web content, return a JSON object with these fields:
- title: string (article title or best inferred title)
- content: string (full article content formatted as markdown, preserving headings and lists)
- sourceUrl: string (the canonical URL of the article, if found in the text; otherwise use "unknown")
- scrapedAt: string (ISO 8601 datetime of when this was scraped, use current time if unknown)

Return ONLY valid JSON. Do not include any explanatory text.`

type ProgressCallback = (event: FeedProgressEvent) => void

async function persistBook(book: Book): Promise<void> {
  await storage.set(STORAGE_KEYS.BOOK_PREFIX + book.id, book)

  const index: string[] = (await storage.get(STORAGE_KEYS.BOOK_INDEX)) ?? []
  if (!index.includes(book.id)) {
    await storage.set(STORAGE_KEYS.BOOK_INDEX, [...index, book.id])
  }
}

/**
 * Orchestrates the full pipeline: NL prompt → keywords → scout → scrape → parse → Book
 */
export async function runThreatSentry(
  config: FeedConfig,
  onProgress: ProgressCallback
): Promise<Book> {
  const bookId = uuidv4()
  const now = new Date().toISOString()

  let book: Book = {
    id: bookId,
    prompt: config.prompt,
    status: "scouting",
    entries: [],
    createdAt: now,
    updatedAt: now
  }

  await persistBook(book)
  onProgress({ type: "feed-progress", bookId, status: "scouting", entriesCount: 0 })

  // Step 1: Extract search queries from the NL prompt
  let queries: string[]
  try {
    queries = await extractKeywords(config.prompt)
  } catch (err) {
    console.error("[threat-sentry] keyword extraction failed:", err)
    queries = [config.prompt]
  }

  // Step 2: Scout the web for each query
  const scoutResults: Array<{ url: string; title: string; content: string; score: number }> = []
  for (const query of queries) {
    try {
      const results = await tavilyScout({
        query,
        maxResults: Math.ceil(config.maxResults / queries.length)
      })
      scoutResults.push(...results)
    } catch (err) {
      console.warn("[threat-sentry] scout failed for query:", query, err)
    }
  }

  // Deduplicate by URL and take top N
  const seen = new Set<string>()
  const deduped = scoutResults.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  }).slice(0, config.maxResults)

  if (deduped.length === 0) {
    book = { ...book, status: "error", error: "No results found for this prompt.", updatedAt: new Date().toISOString() }
    await persistBook(book)
    onProgress({ type: "feed-progress", bookId, status: "error", entriesCount: 0, message: book.error })
    return book
  }

  // Step 3: Scrape each result with TinyFish
  book = { ...book, status: "scraping", updatedAt: new Date().toISOString() }
  await persistBook(book)
  onProgress({ type: "feed-progress", bookId, status: "scraping", entriesCount: 0 })

  const scrapedItems: Array<{ url: string; title: string; rawContent: string; fallbackContent: string }> = []

  for (const result of deduped) {
    onProgress({
      type: "feed-progress",
      bookId,
      status: "scraping",
      entriesCount: book.entries.length,
      message: `Scraping: ${result.url}`
    })

    const { content, success } = await runTinyFish({
      url: result.url,
      goal: "Extract the full article content, author, date, and any relevant identifiers. Return as structured text.",
      onProgress: (partial) =>
        onProgress({
          type: "feed-progress",
          bookId,
          status: "scraping",
          entriesCount: book.entries.length,
          message: partial.message
        })
    })

    scrapedItems.push({
      url: result.url,
      title: result.title,
      rawContent: success ? content : "",
      fallbackContent: result.content // Tavily snippet as fallback
    })
  }

  // Step 4: Parse each scraped result into a BookEntry
  book = { ...book, status: "parsing", updatedAt: new Date().toISOString() }
  await persistBook(book)
  onProgress({ type: "feed-progress", bookId, status: "parsing", entriesCount: book.entries.length })

  for (const item of scrapedItems) {
    const contentToparse = item.rawContent || item.fallbackContent
    if (!contentToparse.trim()) {
      console.warn("[threat-sentry] skipping empty content for", item.url)
      continue
    }

    const rawJson = await llmA_parse(contentToparse, PARSE_SYSTEM_PROMPT)
    if (!rawJson) {
      console.warn("[threat-sentry] parse returned null for", item.url, "— using fallback")
      // Use Tavily snippet as fallback entry
      const fallbackEntry: BookEntry = {
        id: uuidv4(),
        title: item.title,
        content: item.fallbackContent,
        sourceUrl: item.url,
        scrapedAt: new Date().toISOString()
      }
      book = { ...book, entries: [...book.entries, fallbackEntry], updatedAt: new Date().toISOString() }
      await persistBook(book)
      onProgress({ type: "feed-progress", bookId, status: "parsing", entriesCount: book.entries.length })
      continue
    }

    try {
      const parsed = JSON.parse(rawJson)
      // Override sourceUrl with known URL since LLM may get it wrong
      parsed.sourceUrl = item.url
      parsed.scrapedAt = parsed.scrapedAt ?? new Date().toISOString()

      const entry = BookEntrySchema.parse({ id: uuidv4(), ...parsed })
      book = { ...book, entries: [...book.entries, entry], updatedAt: new Date().toISOString() }
      await persistBook(book)
      onProgress({ type: "feed-progress", bookId, status: "parsing", entriesCount: book.entries.length })
    } catch (err) {
      console.warn("[threat-sentry] BookEntry validation failed for", item.url, err)
      // Skip invalid entries rather than crashing
    }
  }

  // Step 5: Finalize
  book = { ...book, status: "done", updatedAt: new Date().toISOString() }
  await persistBook(book)
  onProgress({ type: "feed-progress", bookId, status: "done", entriesCount: book.entries.length })

  return book
}
