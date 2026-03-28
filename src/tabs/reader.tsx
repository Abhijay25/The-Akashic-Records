import { useEffect, useMemo, useState } from "react"
import { Storage } from "@plasmohq/storage"
import { STORAGE_KEYS } from "~types/constants"
import type { Book, Chapter } from "~types/book"

const localStore = new Storage({ area: "local" })

const TEMPLATE_META_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  news: [
    { key: "source", label: "Source" },
    { key: "author", label: "Author" },
    { key: "publishedDate", label: "Published" },
    { key: "category", label: "Category" },
  ],
  cve: [
    { key: "cveId", label: "CVE" },
    { key: "cvssScore", label: "CVSS" },
    { key: "severity", label: "Severity" },
    { key: "affectedProducts", label: "Affected" },
    { key: "publishedDate", label: "Published" },
    { key: "source", label: "Source" },
  ],
  "job-posting": [
    { key: "company", label: "Company" },
    { key: "location", label: "Location" },
    { key: "employmentType", label: "Type" },
    { key: "salary", label: "Salary" },
    { key: "postedDate", label: "Posted" },
    { key: "applicationDeadline", label: "Deadline" },
  ],
  "market-data": [
    { key: "assetName", label: "Asset" },
    { key: "ticker", label: "Ticker" },
    { key: "assetType", label: "Type" },
    { key: "price", label: "Price" },
    { key: "changePercent", label: "Change" },
    { key: "volume", label: "Volume" },
    { key: "marketCap", label: "Market Cap" },
    { key: "timestamp", label: "As Of" },
  ],
  "financial-analysis": [
    { key: "analyst", label: "Analyst" },
    { key: "firm", label: "Firm" },
    { key: "subject", label: "Subject" },
    { key: "analysisType", label: "Type" },
    { key: "rating", label: "Rating" },
    { key: "priceTarget", label: "Price Target" },
    { key: "publishedDate", label: "Published" },
  ],
  "product-release": [
    { key: "productName", label: "Product" },
    { key: "version", label: "Version" },
    { key: "company", label: "Company" },
    { key: "releaseType", label: "Release Type" },
    { key: "releaseDate", label: "Released" },
    { key: "pricing", label: "Pricing" },
    { key: "availability", label: "Availability" },
  ],
  geopolitics: [
    { key: "region", label: "Region" },
    { key: "actors", label: "Actors" },
    { key: "eventType", label: "Event Type" },
    { key: "eventDate", label: "Event Date" },
    { key: "source", label: "Source" },
  ],
}

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim()
}

function stripTemplateHeader(content: string): string {
  const parts = content.split("\n---\n")
  return parts.length > 1 ? parts.slice(1).join("\n---\n").trim() : content.trim()
}

function renderContent(content: string): Array<{ type: "h2" | "h3" | "bullet" | "body"; text: string }> {
  return stripTemplateHeader(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("### ")) {
        return { type: "h3" as const, text: cleanInlineMarkdown(line.slice(4)) }
      }
      if (line.startsWith("## ")) {
        return { type: "h2" as const, text: cleanInlineMarkdown(line.slice(3)) }
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return { type: "bullet" as const, text: cleanInlineMarkdown(line.slice(2)) }
      }
      return { type: "body" as const, text: cleanInlineMarkdown(line.replace(/^#{1,6}\s+/, "")) }
    })
}

export default function Reader() {
  const [book, setBook] = useState<Book | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const params = new URLSearchParams(window.location.search)
      const bookId = params.get("bookId")
      const entryId = params.get("entryId")

      if (!bookId || !entryId) {
        setError("Missing book or chapter ID.")
        return
      }

      const storedBook = await localStore.get<Book>(`${STORAGE_KEYS.BOOK_PREFIX}${bookId}`)
      if (!storedBook) {
        setError("Saved article not found.")
        return
      }

      const storedChapter = storedBook.chapters.find((item) => item.id === entryId)
      if (!storedChapter) {
        setError("Saved chapter not found.")
        return
      }

      setBook(storedBook)
      setChapter(storedChapter)
    }

    void load()
  }, [])

  const blocks = useMemo(() => (chapter ? renderContent(chapter.content) : []), [chapter])
  const metadataEntries = useMemo(() => {
    if (!book || !chapter?.metadata) return []
    const fields = TEMPLATE_META_FIELDS[book.templateId] ?? []
    return fields
      .map((field) => {
        const raw = chapter.metadata?.[field.key]
        if (raw === null || raw === undefined || raw === "") return null
        if (typeof raw === "boolean") return { label: field.label, value: raw ? "Yes" : "No" }
        return { label: field.label, value: String(raw) }
      })
      .filter((entry): entry is { label: string; value: string } => entry !== null)
  }, [book, chapter])

  if (error) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-3xl border border-stone-800 bg-stone-900/60 p-8">
          <p className="text-lg text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  if (!book || !chapter) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-3xl border border-stone-800 bg-stone-900/60 p-8">
          <p className="text-sm text-stone-400">Loading article...</p>
        </div>
      </div>
    )
  }

  const sourceHost = (() => {
    try {
      return new URL(chapter.sourceUrl).hostname
    } catch {
      return chapter.sourceUrl
    }
  })()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_transparent_24%),radial-gradient(circle_at_bottom,_rgba(251,191,36,0.08),_transparent_30%),linear-gradient(180deg,_#0c0a09,_#1c1917)] text-stone-100">
      <main className="mx-auto flex max-w-6xl justify-center px-4 py-8 md:px-8 md:py-14">
        <div className="w-full max-w-[860px] overflow-hidden rounded-[2rem] border border-stone-800/80 bg-stone-950/85 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="border-b border-stone-800 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(251,191,36,0.01))] px-6 py-8 text-center md:px-12 md:py-10">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/80">{book.prompt}</p>
              <span className="rounded-full border border-amber-200/20 bg-amber-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-100/80">
                {book.templateId}
              </span>
            </div>
            <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold leading-tight text-stone-50 md:text-5xl md:leading-[1.1]">
              {chapter.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-stone-400">
              <span>{sourceHost}</span>
              <span className="text-stone-700">•</span>
              <a
                href={chapter.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-amber-200 hover:text-amber-100"
              >
                Open source
              </a>
            </div>
          </div>

          <article className="px-5 py-8 md:px-10 md:py-12">
            {metadataEntries.length > 0 && (
              <section className="mx-auto mb-10 grid max-w-3xl gap-3 rounded-[1.5rem] border border-stone-800/80 bg-stone-900/50 p-5 md:grid-cols-2">
                {metadataEntries.map((entry) => (
                  <div key={entry.label}>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">{entry.label}</p>
                    <p className="mt-1 text-sm leading-6 text-stone-200">{entry.value}</p>
                  </div>
                ))}
              </section>
            )}

            <div className="mx-auto max-w-2xl space-y-6 text-center text-[18px] leading-9 text-stone-200 md:text-[20px] md:leading-10">
              {blocks.map((block, index) => {
                if (block.type === "h2") {
                  return (
                    <h2 key={index} className="pt-6 text-center text-2xl font-semibold leading-tight text-stone-50 md:text-3xl">
                      {block.text}
                    </h2>
                  )
                }

                if (block.type === "h3") {
                  return (
                    <h3 key={index} className="pt-3 text-center text-xl font-semibold leading-tight text-stone-100 md:text-2xl">
                      {block.text}
                    </h3>
                  )
                }

                if (block.type === "bullet") {
                  return (
                    <div key={index} className="mx-auto flex max-w-xl items-start justify-center gap-3 text-left">
                      <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                      <p className="flex-1">{block.text}</p>
                    </div>
                  )
                }

                return <p key={index} className="text-balance">{block.text}</p>
              })}
            </div>
          </article>
        </div>
      </main>
    </div>
  )
}
