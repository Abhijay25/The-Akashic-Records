import { Storage } from "@plasmohq/storage"
import { tavilyScout } from "~utils/tavily"
import { filterBlacklisted } from "~utils/blacklist"
import { KNOWN_DATA_BROKERS, MOCK_PERSONA, isDigitalGhostPrompt } from "~types/librarian"
import { extractAtsLink, executeDataBrokerOptOut, executeTinyFishForm, submitFilledForm } from "~utils/tinyfish-execute"
import { STORAGE_KEYS } from "~types/constants"
import { LibrarianJobSchema } from "~types/librarian"
import type {
  TaskPayload,
  LibrarianJob,
  ExecutionResult,
  UserPersona,
} from "~types/librarian"
import type { LibrarianProgressEvent } from "~types/messages"

const storage = new Storage({ area: "local" })

/** Number of LinkedIn URLs to process concurrently during ATS extraction */
const SCRAPE_BATCH_SIZE = 3

type ProgressCallback = (event: LibrarianProgressEvent) => void

// ── Persistence ──────────────────────────────────────────────────────────────

async function persistJob(job: LibrarianJob): Promise<void> {
  await storage.set(STORAGE_KEYS.LIBRARIAN_JOB_PREFIX + job.id, job)
  const index: string[] =
    (await storage.get(STORAGE_KEYS.LIBRARIAN_JOBS_INDEX)) ?? []
  if (!index.includes(job.id)) {
    await storage.set(STORAGE_KEYS.LIBRARIAN_JOBS_INDEX, [...index, job.id])
  }
}

async function persistProgress(event: LibrarianProgressEvent): Promise<void> {
  await storage.set(STORAGE_KEYS.LIBRARIAN_PROGRESS_PREFIX + event.jobId, event)
}

// ── Batch Processing ─────────────────────────────────────────────────────────

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

// ── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Runs the full Librarian pipeline.
 *
 * Mode A (AD_HOC_PROMPT): Scout LinkedIn → Extract ATS links → Fill forms → HITL pause
 * Mode B (FEED_BATCH): Filter blacklist → Fill forms → HITL pause
 *
 * Pipeline stops at "awaiting_approval". The approve-submit handler resumes it.
 */
export async function runLibrarian(
  payload: TaskPayload,
  onProgress: ProgressCallback,
  options: { requireHitl: boolean; persona?: UserPersona } = { requireHitl: false }
): Promise<LibrarianJob> {
  const now = new Date().toISOString()

  let job: LibrarianJob = {
    id: crypto.randomUUID(),
    payload,
    status: "idle",
    results: [],
    createdAt: now,
    updatedAt: now,
  }

  await persistJob(job)

  // Helper to emit progress and persist updated job state
  const emit = async (
    update: Partial<LibrarianJob> & { message?: string }
  ): Promise<void> => {
    const { message, ...jobUpdate } = update
    job = { ...job, ...jobUpdate, updatedAt: new Date().toISOString() }
    await persistJob(job)
    const event: LibrarianProgressEvent = {
      type: "librarian-progress",
      jobId: job.id,
      status: job.status,
      completedCount: job.results.filter(
        (r) => r.status === "filled" || r.status === "submitted"
      ).length,
      totalCount: job.results.length,
      results: job.results,
      message,
    }
    await persistProgress(event)
    onProgress(event)
  }

  // Emit initial event so callers get the jobId immediately
  await emit({ status: "idle", message: "Starting Librarian…" })

  const persona = options.persona ?? MOCK_PERSONA
  const isDigitalGhost = payload.type === "AD_HOC_PROMPT" && isDigitalGhostPrompt(payload.prompt)

  // ── Phase 2 (Mode A only): Scout LinkedIn ────────────────────────────────

  let atsUrls: string[] = []

  if (isDigitalGhost) {
    const maxResults = Math.min(payload.maxResults, KNOWN_DATA_BROKERS.length)
    const selectedBrokers = KNOWN_DATA_BROKERS.slice(0, maxResults)

    await emit({
      status: "scouting",
      message: `Finding ${selectedBrokers.length} data broker opt-out flow${selectedBrokers.length === 1 ? "" : "s"}…`,
    })

    atsUrls = selectedBrokers.map((broker) => broker.url)
  } else if (payload.type === "AD_HOC_PROMPT") {
    await emit({
      status: "scouting",
      message: `Searching for "${payload.prompt}"…`,
    })

    const query = `${payload.prompt} site:linkedin.com/jobs/view`
    let scoutResults: Array<{ url: string; title: string }> = []

    try {
      const results = await tavilyScout({
        query,
        maxResults: payload.maxResults,
      })
      scoutResults = results.filter((r) =>
        r.url.includes("linkedin.com/jobs/view")
      )
    } catch (err) {
      console.warn("[librarian] tavilyScout failed:", err)
    }

    if (scoutResults.length === 0) {
      await emit({
        status: "error",
        error: "No job listings found",
        message: "No job listings found for this prompt",
      })
      return job
    }

    // ── Phase 3 (Mode A only): Extract ATS Links ──────────────────────────

    await emit({
      status: "extracting",
      message: `Found ${scoutResults.length} LinkedIn job${scoutResults.length === 1 ? "" : "s"} — extracting ATS links…`,
    })

    const extractResults = await batchProcess(
      scoutResults,
      SCRAPE_BATCH_SIZE,
      async (result, index) => {
        const progressEvent: LibrarianProgressEvent = {
          type: "librarian-progress",
          jobId: job.id,
          status: "extracting",
          completedCount: index,
          totalCount: scoutResults.length,
          results: job.results,
          message: `Extracting ATS link ${index + 1} of ${scoutResults.length}…`,
        }
        await persistProgress(progressEvent)
        onProgress(progressEvent)
        try {
          return await extractAtsLink(result.url)
        } catch (err) {
          console.warn("[librarian] extractAtsLink failed for", result.url, err)
          return { atsUrl: null, jobTitle: "", company: "" }
        }
      }
    )

    const extracted = extractResults.filter((r) => r.atsUrl !== null)
    const easyApplySkipped = extractResults.length - extracted.length

    if (easyApplySkipped > 0) {
      console.info(
        `[librarian] ${easyApplySkipped} job(s) skipped (Easy Apply only)`
      )
    }

    atsUrls = extracted.map((r) => r.atsUrl as string)
  } else {
    // Mode B: use URLs directly from payload
    atsUrls = payload.urls
  }

  // ── Filter Blacklist ──────────────────────────────────────────────────────

  const { allowed, blocked } = filterBlacklisted(atsUrls)

  if (blocked.length > 0) {
    console.info(
      `[librarian] ${blocked.length} URL(s) blocked by blacklist:`,
      blocked
    )
  }

  if (allowed.length === 0) {
    await emit({
      status: "error",
      error: "All URLs are on the blacklist",
      message: "All URLs are on the blacklist — no applications to process",
    })
    return job
  }

  // ── Phase 4: Execute (sequential form-filling) ───────────────────────────

  await emit({
    status: "executing",
    results: [],
    message: isDigitalGhost
      ? `Preparing ${allowed.length} broker removal request${allowed.length === 1 ? "" : "s"}…`
      : `Filling ${allowed.length} application form${allowed.length === 1 ? "" : "s"}…`,
  })

  for (let i = 0; i < allowed.length; i++) {
    const url = allowed[i]

    const progressEvent: LibrarianProgressEvent = {
      type: "librarian-progress",
      jobId: job.id,
      status: "executing",
      completedCount: i,
      totalCount: allowed.length,
      results: job.results,
      message: isDigitalGhost
        ? `Preparing broker request ${i + 1} of ${allowed.length}…`
        : `Filling form ${i + 1} of ${allowed.length}…`,
    }
    await persistProgress(progressEvent)
    onProgress(progressEvent)

    const handleExecutionProgress = async (message: string) => {
      job = {
        ...job,
        updatedAt: new Date().toISOString(),
      }
      await persistJob(job)
      const detailEvent: LibrarianProgressEvent = {
        type: "librarian-progress",
        jobId: job.id,
        status: "executing",
        completedCount: i,
        totalCount: allowed.length,
        results: job.results,
        message: `[TinyFish] ${message}`,
      }
      await persistProgress(detailEvent)
      onProgress(detailEvent)
    }

    let result: ExecutionResult
    try {
      result = isDigitalGhost
        ? await executeDataBrokerOptOut({ url, persona, onProgress: handleExecutionProgress })
        : await executeTinyFishForm({ url, persona, onProgress: handleExecutionProgress })
    } catch (err) {
      result = {
        url,
        status: "error",
        error: String(err),
      }
    }

    job = {
      ...job,
      results: [...job.results, result],
      updatedAt: new Date().toISOString(),
    }
    await persistJob(job)
  }

  // ── Phase 5: Submit or Pause ─────────────────────────────────────────────

  const filledCount = job.results.filter((r) => r.status === "filled").length
  const errorCount = job.results.filter((r) => r.status === "error").length

  if (filledCount === 0) {
    await emit({
      status: "done",
      message: isDigitalGhost
        ? `All ${errorCount} broker request${errorCount === 1 ? "" : "s"} failed`
        : `All ${errorCount} application${errorCount === 1 ? "" : "s"} failed`,
    })
    return job
  }

  if (!options.requireHitl) {
    // Auto-submit all filled forms without pausing
    await emit({
      status: "submitting",
      message: isDigitalGhost
        ? `Submitting ${filledCount} broker removal request${filledCount === 1 ? "" : "s"}…`
        : `Submitting ${filledCount} application${filledCount === 1 ? "" : "s"}…`,
    })
    for (const result of job.results.filter((r) => r.status === "filled")) {
      let submitResult: ExecutionResult
      try {
        submitResult = await submitFilledForm(result.url)
      } catch (err) {
        submitResult = { url: result.url, status: "error", error: String(err) }
      }
      job = {
        ...job,
        results: job.results.map((r) => r.url === result.url ? { ...r, ...submitResult } : r),
        updatedAt: new Date().toISOString(),
      }
      await persistJob(job)
    }
    const submittedCount = job.results.filter((r) => r.status === "submitted").length
    await emit({
      status: "done",
      message: isDigitalGhost
        ? `Done — ${submittedCount} broker request${submittedCount === 1 ? "" : "s"} submitted`
        : `Done — ${submittedCount} application${submittedCount === 1 ? "" : "s"} submitted`,
    })
  } else {
    // HITL mode: pause and wait for approve-submit
    await emit({
      status: "awaiting_approval",
      message: isDigitalGhost
        ? `${filledCount} broker request${filledCount === 1 ? "" : "s"} ready — review and approve to submit`
        : `${filledCount} form${filledCount === 1 ? "" : "s"} filled — review and approve to submit`,
    })
  }

  return job
}
