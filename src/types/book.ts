import { z } from "zod"

export const BookEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(), // markdown
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
  status: BookStatusSchema,
  entries: z.array(BookEntrySchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  error: z.string().optional()
})

export const FeedConfigSchema = z.object({
  prompt: z.string().min(1),
  maxResults: z.number().int().min(1).max(20).default(5),
  browserProfile: z.enum(["lite", "full"]).default("lite")
})

export type BookEntry = z.infer<typeof BookEntrySchema>
export type BookStatus = z.infer<typeof BookStatusSchema>
export type Book = z.infer<typeof BookSchema>
export type FeedConfig = z.infer<typeof FeedConfigSchema>
