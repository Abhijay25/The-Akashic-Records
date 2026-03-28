import { Storage } from "@plasmohq/storage"
import { extractKeywords, llmA_parse } from "~utils/openai"
import { tavilyScout } from "~utils/tavily"
import { runTinyFish } from "~utils/tinyfish"
import { BookSchema, ChapterSchema } from "~types/book"
import { STORAGE_KEYS } from "~types/constants"
import { detectTemplate, getTemplate } from "~templates/index"
import type { Book, Chapter, FeedConfig } from "~types/book"
import type { FeedProgressEvent } from "~types/messages"

const storage = new Storage({ area: "local" })

/** Number of URLs to scrape concurrently — balances speed vs. rate limits */
const SCRAPE_BATCH_SIZE = 3

type ProgressCallback = (event: FeedProgressEvent) => void

async function persistBook(book: Book): Promise<void> {
  await storage.set(STORAGE_KEYS.BOOK_PREFIX + book.id, book)
  const index: string[] = (await storage.get(STORAGE_KEYS.BOOK_INDEX)) ?? []
  if (!index.includes(book.id)) {
    await storage.set(STORAGE_KEYS.BOOK_INDEX, [...index, book.id])
  }
}

async function persistProgress(event: FeedProgressEvent): Promise<void> {
  await storage.set(STORAGE_KEYS.FEED_PROGRESS_PREFIX + event.bookId, event)
}

/**
 * Processes an array of items in parallel batches.
 * Items within a batch run concurrently; batches run sequentially.
 */
async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((item, j) => fn(item, i + j))
    )
    results.push(...batchResults)
  }
  return results
}

/**
 * Full pipeline: NL prompt → template detection → keywords → scout → scrape (batched) → parse → Book
 * If config.bookId is provided, refreshes that existing Book (new chapters prepended, no URL repeats).
 */
export async function runThreatSentry(
  config: FeedConfig,
  onProgress: ProgressCallback
): Promise<Book> {
  const now = new Date().toISOString()
  const isRefresh = !!config.bookId

  const template = config.templateId
    ? getTemplate(config.templateId)
    : detectTemplate(config.prompt)

  // Load existing book on refresh, or create a fresh one
  let existingChapters: Chapter[] = []
  let seenUrls = new Set<string>()

  let book: Book

  if (isRefresh) {
    const existing = await storage.get<Book>(
      STORAGE_KEYS.BOOK_PREFIX + config.bookId
    )
    if (!existing) {
      // bookId not found — fall back to creating a new book
      console.warn("[library] refresh bookId not found, creating new book")
    } else {
      existingChapters = existing.chapters
      seenUrls = new Set(existing.chapters.map((c) => c.sourceUrl))
      book = { ...existing, status: "scouting", updatedAt: now }
      await persistBook(book)
    }
  }

  if (!book) {
    book = {
      id: crypto.randomUUID(),
      prompt: config.prompt,
      templateId: template.id,
      status: "scouting",
      chapters: [],
      createdAt: now,
      updatedAt: now
    }
    await persistBook(book)
  }

  const bookId = book.id

  // ── Phase 1: Extract search queries ─────────────────────────────────────
  onProgress({
    type: "feed-progress",
    bookId,
    status: "scouting",
    chaptersCount: 0,
    message: "Breaking down your prompt…"
  })
  await persistProgress({
    type: "feed-progress",
    bookId,
    status: "scouting",
    chaptersCount: 0,
    message: "Breaking down your prompt…"
  })

  let queries: string[]
  try {
    queries = await extractKeywords(config.prompt)
  } catch (err) {
    console.warn("[library] extractKeywords failed, using raw prompt:", err)
    queries = [config.prompt]
  }

  // ── Phase 2: Scout the web ───────────────────────────────────────────────
  const scoutingEvent: FeedProgressEvent = {
    type: "feed-progress",
    bookId,
    status: "scouting",
    chaptersCount: 0,
    message: `Searching for "${config.prompt}"…`
  }
  onProgress(scoutingEvent)
  await persistProgress(scoutingEvent)

  const scoutResults: Array<{
    url: string
    title: string
    content: string
    score: number
  }> = []

  for (const query of queries) {
    try {
      const results = await tavilyScout({
        query,
        maxResults: Math.ceil(config.maxResults / queries.length)
      })
      scoutResults.push(...results)
    } catch (err) {
      console.warn("[library] scout failed for query:", query, err)
    }
  }

  // Deduplicate within scout results, then filter out URLs already in this Book
  const deduped = scoutResults
    .filter((r) => {
      if (seenUrls.has(r.url)) return false
      seenUrls.add(r.url)
      return true
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxResults)

  if (deduped.length === 0) {
    book = {
      ...book,
      status: "error",
      error: "No results found for this prompt.",
      updatedAt: new Date().toISOString()
    }
    await persistBook(book)
    const errorEvent: FeedProgressEvent = {
      type: "feed-progress",
      bookId,
      status: "error",
      chaptersCount: 0,
      message: book.error
    }
    onProgress(errorEvent)
    await persistProgress(errorEvent)
    return book
  }

  // ── Phase 3: Scrape with TinyFish (parallel batches) ────────────────────
  book = { ...book, status: "scraping", updatedAt: new Date().toISOString() }
  await persistBook(book)

  const scrapingEvent: FeedProgressEvent = {
    type: "feed-progress",
    bookId,
    status: "scraping",
    chaptersCount: 0,
    message: `Found ${deduped.length} sources — extracting content…`
  }
  onProgress(scrapingEvent)
  await persistProgress(scrapingEvent)

  type ScrapedItem = {
    url: string
    title: string
    rawContent: string
    fallbackContent: string
  }

  const scrapedItems = await batchProcess<(typeof deduped)[0], ScrapedItem>(
    deduped,
    SCRAPE_BATCH_SIZE,
    async (result, index) => {
      const progressEvent: FeedProgressEvent = {
        type: "feed-progress",
        bookId,
        status: "scraping",
        chaptersCount: book.chapters.length,
        message: `Extracting source ${index + 1} of ${deduped.length}…`
      }
      onProgress(progressEvent)
      await persistProgress(progressEvent)

      if (config.browserProfile === "lite") {
        return {
          url: result.url,
          title: result.title,
          rawContent: "",
          fallbackContent: result.content
        }
      }

      const { content, success } = await runTinyFish({
        url: result.url,
        goal: template.tinyfishGoal,
        browserProfile: config.browserProfile
      })

      return {
        url: result.url,
        title: result.title,
        rawContent: success ? content : "",
        fallbackContent: result.content
      }
    }
  )

  // ── Phase 4: Parse scraped content into Chapters ─────────────────────────
  book = { ...book, status: "parsing", updatedAt: new Date().toISOString() }
  await persistBook(book)

  const total = scrapedItems.length

  for (let i = 0; i < scrapedItems.length; i++) {
    const item = scrapedItems[i]

    const parsingEvent: FeedProgressEvent = {
      type: "feed-progress",
      bookId,
      status: "parsing",
      chaptersCount: book.chapters.length,
      message: `Summarizing chapter ${i + 1} of ${total}…`
    }
    onProgress(parsingEvent)
    await persistProgress(parsingEvent)

    const contentToParse = item.rawContent || item.fallbackContent
    if (!contentToParse.trim()) {
      console.warn("[library] skipping empty content for", item.url)
      continue
    }

    const rawJson = await llmA_parse(contentToParse, template.parseSystemPrompt)

    if (!rawJson) {
      // LLM failed twice — use Tavily snippet as plain fallback chapter
      const fallbackChapter: Chapter = {
        id: crypto.randomUUID(),
        title: item.title,
        content: item.fallbackContent,
        sourceUrl: item.url,
        scrapedAt: new Date().toISOString()
      }
      book = {
        ...book,
        chapters: [...book.chapters, fallbackChapter],
        updatedAt: new Date().toISOString()
      }
      await persistBook(book)
      continue
    }

    try {
      const parsed = JSON.parse(rawJson)
      const chapter = ChapterSchema.parse({
        id: crypto.randomUUID(),
        title: parsed.title,
        content: parsed.content,
        metadata: parsed.metadata ?? undefined,
        sourceUrl: item.url,
        scrapedAt: new Date().toISOString()
      })
      book = {
        ...book,
        chapters: [...book.chapters, chapter],
        updatedAt: new Date().toISOString()
      }
      await persistBook(book)
    } catch (err) {
      console.warn("[library] chapter validation failed for", item.url, err)
    }
  }

  // ── Done ────────────────────────────────────────────────────────────────
  // On refresh: prepend new chapters so latest appear first; preserve existing ones
  const newChapters = book.chapters
  const finalChapters = isRefresh
    ? [...newChapters, ...existingChapters]
    : newChapters

  book = {
    ...book,
    chapters: finalChapters,
    status: "done",
    updatedAt: new Date().toISOString()
  }
  await persistBook(book)

  const newCount = newChapters.length
  const doneMessage = isRefresh
    ? `Refresh complete — ${newCount} new chapter${newCount === 1 ? "" : "s"} added`
    : `Done — ${finalChapters.length} chapter${finalChapters.length === 1 ? "" : "s"} ready`

  const doneEvent: FeedProgressEvent = {
    type: "feed-progress",
    bookId,
    status: "done",
    chaptersCount: finalChapters.length,
    message: doneMessage
  }
  onProgress(doneEvent)
  await persistProgress(doneEvent)

  return book
}
