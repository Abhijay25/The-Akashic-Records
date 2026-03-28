import { useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import { usePort } from "@plasmohq/messaging/hook"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"
import { STORAGE_KEYS } from "~types/constants"
import type { StartFeedResponse, FeedProgressEvent, LibrarianProgressEvent } from "~types/messages"
import type { Book, Chapter } from "~types/book"

const localStore = new Storage({ area: "local" })
const DEFAULT_LIBRARY_RESULTS = 8

type PortEvent = FeedProgressEvent | LibrarianProgressEvent
// Cast needed until `plasmo dev` generates PortsMetadata types
const useAgentPort = () =>
  (usePort as (name: string) => { data?: PortEvent })("agent-status")

export default function LibraryView() {
  const [activeBookId, setActiveBookId] = useState<string | null>(null)
  const [bookIds] = useStorage<string[]>({ key: STORAGE_KEYS.BOOK_INDEX, instance: localStore }, [])

  return (
    <div className="flex h-full overflow-hidden">
      {/* History sidebar */}
      <div className="w-[130px] shrink-0 border-r border-[#F6B37A] flex flex-col overflow-hidden bg-[#FFF6ED]">
        <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
          History
        </div>
        <div className="flex-1 overflow-y-auto">
          {!bookIds || bookIds.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-gray-400">No searches yet</p>
          ) : (
            [...bookIds].reverse().map((id) => (
              <HistoryItem
                key={id}
                bookId={id}
                isActive={id === activeBookId}
                onClick={() => setActiveBookId(id)}
              />
            ))
          )}
        </div>
        <button
          onClick={() => setActiveBookId(null)}
          className="m-2 py-1.5 text-[11px] text-gray-500 hover:text-black border border-[#F6B37A] hover:border-[#FF7A00] rounded transition-colors"
        >
          + New
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
        {activeBookId ? (
          <ActiveBook bookId={activeBookId} onNewSearch={() => setActiveBookId(null)} />
        ) : (
          <PromptView onBookCreated={setActiveBookId} />
        )}
      </div>
    </div>
  )
}

function HistoryItem({
  bookId,
  isActive,
  onClick,
}: {
  bookId: string
  isActive: boolean
  onClick: () => void
}) {
  const [book] = useStorage<Book>({ key: `${STORAGE_KEYS.BOOK_PREFIX}${bookId}`, instance: localStore })
  return (
    <button
      onClick={onClick}
      title={book?.prompt}
      className={`w-full text-left px-3 py-2 text-[11px] leading-tight transition-colors ${
        isActive
          ? "bg-[#F6B37A] text-black font-medium"
          : "text-gray-600 hover:text-black hover:bg-white"
      }`}
    >
      <span className="line-clamp-2">{book?.prompt ?? "..."}</span>
    </button>
  )
}

function ActiveBook({ bookId, onNewSearch }: { bookId: string; onNewSearch: () => void }) {
  const [book] = useStorage<Book>({ key: `${STORAGE_KEYS.BOOK_PREFIX}${bookId}`, instance: localStore })
  const [storedFeedEvent] = useStorage<FeedProgressEvent>({
    key: `${STORAGE_KEYS.FEED_PROGRESS_PREFIX}${bookId}`,
    instance: localStore,
  })
  const port = useAgentPort()

  const raw = port.data
  // Only use live port events for the active in-progress book — never override a stored "done" state
  // Only use live port events while the book is actively in-progress.
  // Never override a terminal state ("done" or "error") stored in chrome.storage.
  const terminalStatuses = new Set(["done", "error"])
  const liveFeedEvent =
    raw?.type === "feed-progress" && raw.bookId === bookId && !terminalStatuses.has(book?.status ?? "")
      ? raw
      : null
  const feedEvent =
    liveFeedEvent ??
    (storedFeedEvent?.type === "feed-progress" && storedFeedEvent.bookId === bookId
      ? storedFeedEvent
      : null)

  // If there's no live event and the book is stuck in an intermediate state,
  // treat it as "done" if it has chapters, or "error" if it has none.
  // Only applies to books that are at least 2 minutes old (not a fresh run).
  const intermediateStatuses = new Set(["idle", "scouting", "scraping", "parsing"])
  const bookAgeMs = book ? Date.now() - new Date(book.updatedAt).getTime() : 0
  const isStuck =
    !liveFeedEvent &&
    book &&
    intermediateStatuses.has(book.status) &&
    bookAgeMs > 120_000
  const effectiveStatus = isStuck
    ? (book.chapters.length > 0 ? "done" : "error")
    : (feedEvent?.status ?? book?.status)

  const status = effectiveStatus
  const chaptersCount = feedEvent?.chaptersCount ?? book?.chapters?.length ?? 0

  if (!book) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#F6B37A] border-t-[#FF7A00] rounded-full animate-spin" />
      </div>
    )
  }

  if (status === "done") {
    if (book.chapters.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-gray-600 text-sm text-center">No articles found</p>
          <p className="text-[11px] text-gray-400 text-center">Try rephrasing your search</p>
          <button onClick={onNewSearch} className="text-xs text-gray-400 hover:text-black transition-colors">
            Try again
          </button>
        </div>
      )
    }
    return <ResultsView book={book} onNewSearch={onNewSearch} />
  }

  if (status === "error") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
        <p className="text-red-500 text-sm text-center">{book.error ?? "Something went wrong"}</p>
        <button onClick={onNewSearch} className="text-xs text-gray-400 hover:text-black transition-colors">
          Try a new search
        </button>
      </div>
    )
  }

  const statusLabel: Record<string, string> = {
    idle: "Starting...",
    scouting: "Searching the web...",
    scraping: "Reading articles...",
    parsing: "Analysing content...",
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <div className="w-7 h-7 border-2 border-[#F6B37A] border-t-[#FF7A00] rounded-full animate-spin" />
      <div className="text-center">
        <p className="text-sm text-black">{statusLabel[status ?? "idle"] ?? "Working..."}</p>
        {chaptersCount > 0 && (
          <p className="text-[11px] text-gray-500 mt-1">
            {chaptersCount} article{chaptersCount !== 1 ? "s" : ""} found
          </p>
        )}
        <p className="text-[10px] text-gray-400 mt-3 italic max-w-[200px] truncate">
          "{book.prompt}"
        </p>
      </div>
    </div>
  )
}

function PromptView({ onBookCreated }: { onBookCreated: (id: string) => void }) {
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!prompt.trim() || isLoading) return
    setIsLoading(true)
    setError(null)
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Service worker timed out — reload the extension and try again.")), 8000)
      )
      // Cast needed until `plasmo dev` generates MessagesMetadata types
      const res = (await Promise.race([
        (sendToBackground as Function)({
          name: "start-feed",
          body: { config: { prompt: prompt.trim(), maxResults: DEFAULT_LIBRARY_RESULTS, browserProfile: "lite" } },
        }),
        timeout,
      ])) as StartFeedResponse
      if (res.error || !res.bookId) {
        setError(res.error ?? "Failed to start search.")
        setIsLoading(false)
      } else {
        onBookCreated(res.bookId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start search. Check your API keys.")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-5 gap-4">
      <div className="text-center">
        <p className="text-sm font-medium text-black">What do you want to read?</p>
        <p className="text-[11px] text-gray-500 mt-1">Get the top articles on any topic</p>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={"e.g. latest news on US-Iran relations\ne.g. Shopee internship openings"}
        disabled={isLoading}
        className="w-full h-28 bg-[#FFF6ED] border border-[#F6B37A] rounded-lg p-3 text-sm text-black placeholder-gray-400 resize-none focus:outline-none focus:border-[#FF7A00] transition-colors"
      />
      {error && <p className="text-red-500 text-xs w-full">{error}</p>}
      <button
        onClick={submit}
        disabled={!prompt.trim() || isLoading}
        className="w-full py-2.5 bg-[#FF7A00] text-white rounded-lg text-sm font-semibold hover:bg-[#F6B37A] hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Starting..." : "Search"}
      </button>
    </div>
  )
}

function ResultsView({ book, onNewSearch }: { book: Book; onNewSearch: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#F6B37A] shrink-0">
        <span className="text-[11px] text-gray-500">{book.chapters.length} articles</span>
        <button
          onClick={onNewSearch}
          className="text-[11px] text-gray-500 hover:text-black transition-colors"
        >
          New search
        </button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-[#FFF6ED]">
        {book.chapters.map((chapter, i) => (
          <ArticleCard key={chapter.id} bookId={book.id} entry={chapter} index={i + 1} />
        ))}
      </div>
    </div>
  )
}

function ArticleCard({ bookId, entry, index }: { bookId: string; entry: Chapter; index: number }) {
  const summary = entry.content
    .replace(/#{1,6}\s/g, "")
    .replace(/[*`_[\]]/g, "")
    .trim()
    .slice(0, 150)

  const hostname = (() => {
    try {
      return new URL(entry.sourceUrl).hostname
    } catch {
      return entry.sourceUrl
    }
  })()

  return (
    <button
      onClick={() =>
        chrome.tabs.create({
          url: chrome.runtime.getURL(`tabs/reader.html?bookId=${encodeURIComponent(bookId)}&entryId=${encodeURIComponent(entry.id)}`),
        })
      }
      className="w-full text-left p-3 hover:bg-[#FFF6ED] transition-colors group"
    >
      <div className="flex gap-2">
        <span className="text-[10px] text-[#FF7A00] font-mono mt-0.5 shrink-0 w-4">{index}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-black leading-snug line-clamp-2">
            {entry.title}
          </p>
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-2">
            {summary}…
          </p>
          <p className="text-[10px] text-gray-400 mt-1 truncate">{hostname}</p>
        </div>
        <span className="text-[#FF7A00] text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
          ↗
        </span>
      </div>
    </button>
  )
}
