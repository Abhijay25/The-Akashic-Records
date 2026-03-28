import { Storage } from "@plasmohq/storage"
import { tavilyScout } from "~utils/tavily"
import { filterBlacklisted } from "~utils/blacklist"
import { MOCK_PERSONA } from "~types/librarian"
import { extractAtsLink, executeTinyFishForm, submitFilledForm } from "~utils/tinyfish-execute"
import { STORAGE_KEYS } from "~types/constants"
import { LibrarianJobSchema } from "~types/librarian"
import type {
  TaskPayload,
  LibrarianJob,
  ExecutionResult,
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
  options: { requireHitl: boolean } = { requireHitl: false }
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
    onProgress({
      type: "librarian-progress",
      jobId: job.id,
      status: job.status,
      completedCount: job.results.filter(
        (r) => r.status === "filled" || r.status === "submitted"
      ).length,
      totalCount: job.results.length,
      results: job.results,
      message,
    })
  }

  // Emit initial event so callers get the jobId immediately
  await emit({ status: "idle", message: "Starting Librarian…" })

  const persona = MOCK_PERSONA

  // ── Phase 2 (Mode A only): Scout LinkedIn ────────────────────────────────

  let atsUrls: string[] = []

  if (payload.type === "AD_HOC_PROMPT") {
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
        onProgress({
          type: "librarian-progress",
          jobId: job.id,
          status: "extracting",
          completedCount: index,
          totalCount: scoutResults.length,
          results: job.results,
          message: `Extracting ATS link ${index + 1} of ${scoutResults.length}…`,
        })
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
    message: `Filling ${allowed.length} application form${allowed.length === 1 ? "" : "s"}…`,
  })

  for (let i = 0; i < allowed.length; i++) {
    const url = allowed[i]

    onProgress({
      type: "librarian-progress",
      jobId: job.id,
      status: "executing",
      completedCount: i,
      totalCount: allowed.length,
      results: job.results,
      message: `Filling form ${i + 1} of ${allowed.length}…`,
    })

    let result: ExecutionResult
    try {
      result = await executeTinyFishForm({ url, persona })
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
      message: `All ${errorCount} application${errorCount === 1 ? "" : "s"} failed`,
    })
    return job
  }

  if (!options.requireHitl) {
    // Auto-submit all filled forms without pausing
    await emit({ status: "submitting", message: `Submitting ${filledCount} application${filledCount === 1 ? "" : "s"}…` })
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
    await emit({ status: "done", message: `Done — ${submittedCount} application${submittedCount === 1 ? "" : "s"} submitted` })
  } else {
    // HITL mode: pause and wait for approve-submit
    await emit({
      status: "awaiting_approval",
      message: `${filledCount} form${filledCount === 1 ? "" : "s"} filled — review and approve to submit`,
    })
  }

  return job
}
