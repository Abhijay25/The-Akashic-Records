import { useState, useEffect, useRef } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import { usePort } from "@plasmohq/messaging/hook"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"
import type {
  StartLibrarianResponse,
  ApproveSubmitResponse,
  LibrarianProgressEvent,
  FeedProgressEvent,
} from "~types/messages"
import { STORAGE_KEYS } from "~types/constants"
import { isDigitalGhostPrompt } from "~types/librarian"
import type { ExecutionResult, LibrarianJob, LibrarianJobStatus } from "~types/librarian"

type PortEvent = FeedProgressEvent | LibrarianProgressEvent

const useAgentPort = () =>
  (usePort as (name: string) => { data?: PortEvent })("agent-status")

const localStore = new Storage({ area: "local" })
const DEFAULT_LIBRARIAN_RESULTS = 3

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

function getResultLabel(result: ExecutionResult): string {
  try {
    return result.jobTitle ?? result.company ?? new URL(result.url).hostname
  } catch {
    return result.jobTitle ?? result.company ?? result.url
  }
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

  const effectiveEvent =
    storedEvent?.type === "librarian-progress" && storedEvent.jobId === jobId
      ? storedEvent
      : latestEvent

  const isDigitalGhost =
    storedJob?.payload.type === "AD_HOC_PROMPT" &&
    isDigitalGhostPrompt(storedJob.payload.prompt)

  useEffect(() => {
    const raw = port.data
    if (!raw || raw.type !== "librarian-progress") return
    if (jobId && raw.jobId !== jobId) return

    setLatestEvent(raw)

    if (raw.message) {
      setStepLog((prev) => {
        if (prev[prev.length - 1] === raw.message) return prev
        return [...prev, raw.message]
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
  }, [jobId, port.data])

  useEffect(() => {
    if (!jobId) return

    const effectiveStatus = storedEvent?.status ?? storedJob?.status
    if (!effectiveStatus) return

    if (
      storedEvent?.type === "librarian-progress" &&
      storedEvent.jobId === jobId &&
      (
        !latestEvent ||
        latestEvent.status !== storedEvent.status ||
        latestEvent.message !== storedEvent.message ||
        latestEvent.completedCount !== storedEvent.completedCount ||
        latestEvent.totalCount !== storedEvent.totalCount
      )
    ) {
      setLatestEvent(storedEvent)
      if (storedEvent.message) {
        setStepLog((prev) => {
          if (prev[prev.length - 1] === storedEvent.message) return prev
          return [...prev, storedEvent.message]
        })
      }
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
          payload: { type: "AD_HOC_PROMPT", prompt: prompt.trim(), maxResults: DEFAULT_LIBRARIAN_RESULTS },
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
    <div className="flex flex-col h-full p-4 gap-4 overflow-hidden bg-white">
      {phase === "idle" && (
        <>
          <div className="text-center mt-2">
            <p className="text-sm font-medium text-black">What do you need done?</p>
            <p className="text-[11px] text-gray-500 mt-1">
              Describe a task and the Librarian will handle it for you
            </p>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              "e.g. Apply to Google, Meta, and Shopee internship listings\n\ne.g. Find all software engineering roles posted this week"
            }
            className="flex-1 bg-brand-bg border border-brand-light rounded-lg p-3 text-sm text-black placeholder-gray-400 resize-none focus:outline-none focus:border-brand transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-light hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Let Librarian handle it
          </button>
        </>
      )}

      {phase === "running" && (
        <>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 border-2 border-brand-light border-t-brand rounded-full animate-spin shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-black truncate">
                {STATUS_LABELS[effectiveEvent?.status ?? storedJob?.status ?? "idle"]}
              </p>
              {(effectiveEvent?.totalCount ?? 0) > 0 && (
                <p className="text-[10px] text-gray-500">
                  {effectiveEvent?.completedCount ?? 0} / {effectiveEvent?.totalCount ?? 0}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-brand-bg rounded-lg p-3 font-mono text-[11px] space-y-2 border border-brand-light">
            {stepLog.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`shrink-0 mt-px ${i < stepLog.length - 1 ? "text-brand" : "text-gray-400"}`}>
                  {i < stepLog.length - 1 ? "✓" : ">"}
                </span>
                <span className={i < stepLog.length - 1 ? "text-gray-400" : "text-black"}>
                  {step}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1 pt-1">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 bg-brand-light rounded-full animate-bounce"
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
            <p className="text-sm font-medium text-black">Review before submitting</p>
            <p className="text-[11px] text-gray-500 mt-1">
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
              className="flex-1 py-2 text-sm text-gray-500 hover:text-black border border-brand-light hover:border-brand rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={approvedUrls.size === 0}
              className="flex-1 py-2 text-sm font-semibold bg-brand text-white hover:bg-brand-light hover:text-black rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Submit {approvedUrls.size > 0 ? `(${approvedUrls.size})` : ""}
            </button>
          </div>
        </>
      )}

      {phase === "done" && latestEvent && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-bg border-2 border-brand-light flex items-center justify-center text-2xl text-brand">
            ✓
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-black">Task done!</p>
            <p className="text-[11px] text-gray-500 mt-1 max-w-[230px] mx-auto">
              {latestEvent.completedCount} of {latestEvent.totalCount} {isDigitalGhost ? "sites" : "applications"} completed successfully
            </p>
          </div>

          {latestEvent.results.filter((r) => r.status === "submitted").length > 0 && (
            <div className="w-full rounded-lg border border-green-300/60 bg-green-50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-green-700">
                {isDigitalGhost ? "Opted Out Of" : "Worked On"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {latestEvent.results
                  .filter((r) => r.status === "submitted")
                  .map((r) => (
                    <span
                      key={r.url}
                      className="rounded-full border border-green-300 bg-white px-2.5 py-1 text-[11px] text-green-800"
                    >
                      {getResultLabel(r)}
                    </span>
                  ))}
              </div>
            </div>
          )}

          <div className="w-full bg-brand-bg border border-brand-light rounded-lg p-3 space-y-2 max-h-44 overflow-y-auto">
            {latestEvent.results.map((r) => (
              <div key={r.url} className="flex items-start gap-2 text-[11px]">
                <span
                  className={
                    r.status === "submitted"
                      ? "text-brand shrink-0"
                      : r.status === "error"
                        ? "text-red-500 shrink-0"
                        : "text-gray-400 shrink-0"
                  }
                >
                  {r.status === "submitted" ? "✓" : r.status === "error" ? "✗" : "—"}
                </span>
                <div className="min-w-0">
                  <p className="text-black truncate">{getResultLabel(r)}</p>
                  {r.error && <p className="text-red-500 truncate">{r.error}</p>}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={reset}
            className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-light hover:text-black transition-colors"
          >
            New task
          </button>
        </div>
      )}

      {phase === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-red-500 text-sm text-center">{error}</p>
          <button onClick={reset} className="text-xs text-gray-400 hover:text-black transition-colors">
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
    try {
      return new URL(result.url).hostname
    } catch {
      return result.url
    }
  })()

  return (
    <label className="flex items-start gap-3 p-2.5 bg-brand-bg border border-brand-light rounded-lg cursor-pointer hover:border-brand transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(result.url, e.target.checked)}
        className="mt-0.5 shrink-0 accent-brand"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-black font-medium truncate">
          {result.jobTitle ?? "Untitled role"}
          {result.company && <span className="text-gray-500 font-normal"> · {result.company}</span>}
        </p>
        <p className="text-[10px] text-gray-400 truncate mt-0.5">{hostname}</p>
      </div>
    </label>
  )
}
