import { z } from "zod"

export const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(), // markdown — structure depends on Book's templateId
  sourceUrl: z.string().url(),
  scrapedAt: z.string().datetime()
})

export const BookStatusSchema = z.enum([
  "idle",
  "scouting",
  "scraping",
  "parsing",
  "done",
  "error"
])

export const BookSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  templateId: z.string(), // which FeedTemplate was used — informs Speedreader rendering
  status: BookStatusSchema,
  chapters: z.array(ChapterSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  error: z.string().optional()
})

export const FeedConfigSchema = z.object({
  prompt: z.string().min(1),
  maxResults: z.number().int().min(1).max(30).default(10),
  browserProfile: z.enum(["lite", "full"]).default("lite"),
  // Optional override — if omitted, detectTemplate() picks automatically
  templateId: z.string().optional()
})

export type Chapter = z.infer<typeof ChapterSchema>
export type BookStatus = z.infer<typeof BookStatusSchema>
export type Book = z.infer<typeof BookSchema>
export type FeedConfig = z.infer<typeof FeedConfigSchema>
