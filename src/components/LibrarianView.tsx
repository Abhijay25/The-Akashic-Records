import { useState, useEffect, useRef } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import { usePort } from "@plasmohq/messaging/hook"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"
import type {
  StartLibrarianRequest,
  StartLibrarianResponse,
  ApproveSubmitRequest,
  ApproveSubmitResponse,
  LibrarianProgressEvent,
  FeedProgressEvent,
} from "~types/messages"
import { STORAGE_KEYS } from "~types/constants"
import type { ExecutionResult, LibrarianJob, LibrarianJobStatus } from "~types/librarian"

type PortEvent = FeedProgressEvent | LibrarianProgressEvent
// Cast needed until `plasmo dev` generates PortsMetadata types
const useAgentPort = () =>
  (usePort as (name: string) => { data?: PortEvent })("agent-status")

const localStore = new Storage({ area: "local" })

type Phase = "idle" | "running" | "hitl" | "done" | "error"

const STATUS_LABELS: Partial<Record<LibrarianJobStatus, string>> = {
  idle: "Starting...",
  scouting: "Scouting for opportunities...",
  extracting: "Extracting job details...",
  executing: "Filling in applications...",
  awaiting_approval: "Ready for your review",
  submitting: "Submitting approved applications...",
  done: "All done!",
  error: "Something went wrong",
}

export default function LibrarianView() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [prompt, setPrompt] = useState("")
  const [jobId, setJobId] = useState<string | null>(null)
  const [stepLog, setStepLog] = useState<string[]>([])
  const [latestEvent, setLatestEvent] = useState<LibrarianProgressEvent | null>(null)
  const [approvedUrls, setApprovedUrls] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const port = useAgentPort()
  const [storedJob] = useStorage<LibrarianJob>({
    key: `${STORAGE_KEYS.LIBRARIAN_JOB_PREFIX}${jobId ?? "__none__"}`,
    instance: localStore,
  })
  const [storedEvent] = useStorage<LibrarianProgressEvent>({
    key: `${STORAGE_KEYS.LIBRARIAN_PROGRESS_PREFIX}${jobId ?? "__none__"}`,
    instance: localStore,
  })

  // Update step log and phase from port events
  useEffect(() => {
    const raw = port.data
    if (!raw || raw.type !== "librarian-progress") return
    if (jobId && raw.jobId !== jobId) return

    setLatestEvent(raw)

    if (raw.message) {
      setStepLog((prev) => {
        if (prev[prev.length - 1] === raw.message) return prev
        return [...prev, raw.message!]
      })
    }

    if (raw.status === "awaiting_approval") {
      setApprovedUrls(new Set(raw.results.filter((r) => r.status === "filled").map((r) => r.url)))
      setPhase("hitl")
    } else if (raw.status === "done") {
      setPhase("done")
    } else if (raw.status === "error") {
      setError(raw.message ?? "Something went wrong")
      setPhase("error")
    }
  }, [port.data])

  useEffect(() => {
    if (!jobId) return

    const effectiveStatus = storedEvent?.status ?? storedJob?.status
    if (!effectiveStatus) return

    if (!latestEvent && storedEvent?.type === "librarian-progress" && storedEvent.jobId === jobId) {
      setLatestEvent(storedEvent)
    }

    if (effectiveStatus === "awaiting_approval") {
      const filledUrls = (storedEvent?.results ?? storedJob?.results ?? [])
        .filter((r) => r.status === "filled")
        .map((r) => r.url)
      setApprovedUrls(new Set(filledUrls))
      setPhase("hitl")
      return
    }

    if (effectiveStatus === "done") {
      setPhase("done")
      return
    }

    if (effectiveStatus === "error") {
      setError(storedEvent?.message ?? storedJob?.error ?? "Something went wrong")
      setPhase("error")
      return
    }

    const jobAgeMs = storedJob ? Date.now() - new Date(storedJob.updatedAt).getTime() : 0
    const stalledStatuses = new Set(["idle", "scouting", "extracting", "executing", "submitting"])
    if (storedJob && stalledStatuses.has(storedJob.status) && jobAgeMs > 120_000) {
      setError("Librarian run did not complete. Try again.")
      setPhase("error")
      return
    }

    setPhase("running")
  }, [jobId, latestEvent, storedEvent, storedJob])

  // Auto-scroll step log
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [stepLog])

  const handleSubmit = async () => {
    if (!prompt.trim()) return
    setPhase("running")
    setStepLog([])
    setLatestEvent(null)
    setError(null)

    try {
      const res = (await (sendToBackground as Function)({
        name: "start-librarian",
        body: {
          payload: { type: "AD_HOC_PROMPT", prompt: prompt.trim(), maxResults: 1 },
        },
      })) as StartLibrarianResponse

      if (res.error) {
        setError(res.error)
        setPhase("error")
      } else if (!res.jobId) {
        setError("Pipeline failed to start. Reload the extension and try again.")
        setPhase("error")
      } else {
        setJobId(res.jobId)
      }
    } catch {
      setError("Failed to contact background agent. Try reloading the extension.")
      setPhase("error")
    }
  }

  const handleApprove = async () => {
    if (!jobId || approvedUrls.size === 0) return

    try {
      const res = (await (sendToBackground as Function)({
        name: "approve-submit",
        body: { jobId, approvedUrls: Array.from(approvedUrls) },
      })) as ApproveSubmitResponse

      if (res.error) {
        setError(res.error)
        setPhase("error")
      } else {
        setPhase("running")
      }
    } catch {
      setError("Failed to submit approvals. Try again.")
      setPhase("error")
    }
  }

  const reset = () => {
    setPhase("idle")
    setPrompt("")
    setJobId(null)
    setStepLog([])
    setLatestEvent(null)
    setError(null)
    setApprovedUrls(new Set())
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-hidden">
      {phase === "idle" && (
        <>
          <div className="text-center mt-2">
            <p className="text-sm font-medium text-gray-200">What do you need done?</p>
            <p className="text-[11px] text-gray-600 mt-1">
              Describe a task and the Librarian will handle it for you
            </p>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              "e.g. Apply to Google, Meta, and Shopee internship listings\n\ne.g. Find all software engineering roles posted this week"
            }
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-100 placeholder-gray-700 resize-none focus:outline-none focus:border-gray-600 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="w-full py-2.5 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Let Librarian handle it
          </button>
        </>
      )}

      {phase === "running" && (
        <>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-300 truncate">
                {STATUS_LABELS[latestEvent?.status ?? "idle"]}
              </p>
              {latestEvent && latestEvent.totalCount > 0 && (
                <p className="text-[10px] text-gray-600">
                  {latestEvent.completedCount} / {latestEvent.totalCount}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-[11px] space-y-2">
            {stepLog.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`shrink-0 mt-px ${i < stepLog.length - 1 ? "text-green-500" : "text-gray-400"}`}>
                  {i < stepLog.length - 1 ? "✓" : ">"}
                </span>
                <span className={i < stepLog.length - 1 ? "text-gray-600" : "text-gray-200"}>
                  {step}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1 pt-1">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <div ref={bottomRef} />
          </div>
        </>
      )}

      {phase === "hitl" && latestEvent && (
        <>
          <div className="shrink-0">
            <p className="text-sm font-medium text-gray-200">Review before submitting</p>
            <p className="text-[11px] text-gray-600 mt-1">
              The Librarian filled these out. Uncheck any you want to skip.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {latestEvent.results
              .filter((r) => r.status === "filled")
              .map((result) => (
                <HitlItem
                  key={result.url}
                  result={result}
                  checked={approvedUrls.has(result.url)}
                  onToggle={(url, checked) => {
                    setApprovedUrls((prev) => {
                      const next = new Set(prev)
                      checked ? next.add(url) : next.delete(url)
                      return next
                    })
                  }}
                />
              ))}
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={reset}
              className="flex-1 py-2 text-sm text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={approvedUrls.size === 0}
              className="flex-1 py-2 text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Submit {approvedUrls.size > 0 ? `(${approvedUrls.size})` : ""}
            </button>
          </div>
        </>
      )}

      {phase === "done" && latestEvent && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-2xl">
            ✓
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-white">Task done!</p>
            <p className="text-[11px] text-gray-600 mt-1 max-w-[230px] mx-auto">
              {latestEvent.completedCount} of {latestEvent.totalCount} submitted successfully
            </p>
          </div>

          <div className="w-full bg-gray-900 rounded-lg p-3 space-y-2 max-h-44 overflow-y-auto">
            {latestEvent.results.map((r) => (
              <div key={r.url} className="flex items-start gap-2 text-[11px]">
                <span className={
                  r.status === "submitted" ? "text-green-500 shrink-0" :
                  r.status === "error" ? "text-red-400 shrink-0" :
                  "text-gray-600 shrink-0"
                }>
                  {r.status === "submitted" ? "✓" : r.status === "error" ? "✗" : "—"}
                </span>
                <div className="min-w-0">
                  <p className="text-gray-300 truncate">
                    {r.jobTitle ?? r.company ?? new URL(r.url).hostname}
                  </p>
                  {r.error && <p className="text-red-400 truncate">{r.error}</p>}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={reset}
            className="w-full py-2.5 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            New task
          </button>
        </div>
      )}

      {phase === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-red-400 text-sm text-center">{error}</p>
          <button onClick={reset} className="text-xs text-gray-500 hover:text-white transition-colors">
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function HitlItem({
  result,
  checked,
  onToggle,
}: {
  result: ExecutionResult
  checked: boolean
  onToggle: (url: string, checked: boolean) => void
}) {
  const hostname = (() => {
    try { return new URL(result.url).hostname } catch { return result.url }
  })()

  return (
    <label className="flex items-start gap-3 p-2.5 bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(result.url, e.target.checked)}
        className="mt-0.5 shrink-0 accent-white"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-200 font-medium truncate">
          {result.jobTitle ?? "Untitled role"}
          {result.company && <span className="text-gray-500 font-normal"> · {result.company}</span>}
        </p>
        <p className="text-[10px] text-gray-600 truncate mt-0.5">{hostname}</p>
      </div>
    </label>
  )
}
