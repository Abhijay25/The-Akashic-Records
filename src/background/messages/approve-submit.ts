import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { submitFilledForm } from "~utils/tinyfish-execute"
import { broadcastProgress } from "~background/ports/agent-status"
import { STORAGE_KEYS } from "~types/constants"
import type { LibrarianJob } from "~types/librarian"
import type { ApproveSubmitRequest, ApproveSubmitResponse } from "~types/messages"

const storage = new Storage({ area: "local" })

const handler: PlasmoMessaging.MessageHandler<
  ApproveSubmitRequest,
  ApproveSubmitResponse
> = async (req, res) => {
  const body = req.body

  if (!body?.jobId || !Array.isArray(body?.approvedUrls)) {
    res.send({ success: false, error: "Missing jobId or approvedUrls" })
    return
  }

  const job = await storage.get<LibrarianJob>(
    STORAGE_KEYS.LIBRARIAN_JOB_PREFIX + body.jobId
  )

  if (!job) {
    res.send({ success: false, error: "Job not found" })
    return
  }

  if (job.status !== "awaiting_approval") {
    res.send({
      success: false,
      error: `Cannot approve: job is in status "${job.status}"`,
    })
    return
  }

  let updatedJob: LibrarianJob = {
    ...job,
    status: "submitting",
    updatedAt: new Date().toISOString(),
  }
  await storage.set(STORAGE_KEYS.LIBRARIAN_JOB_PREFIX + updatedJob.id, updatedJob)

  broadcastProgress({
    type: "librarian-progress",
    jobId: updatedJob.id,
    status: "submitting",
    completedCount: 0,
    totalCount: body.approvedUrls.length,
    results: updatedJob.results,
    message: `Submitting ${body.approvedUrls.length} approved application${body.approvedUrls.length === 1 ? "" : "s"}…`,
  })

  // Submit approved URLs sequentially
  for (let i = 0; i < body.approvedUrls.length; i++) {
    const url = body.approvedUrls[i]

    let submitResult
    try {
      submitResult = await submitFilledForm(url)
    } catch (err) {
      submitResult = {
        url,
        status: "error" as const,
        error: String(err),
      }
    }

    // Replace the existing result for this URL with the submit result
    updatedJob = {
      ...updatedJob,
      results: updatedJob.results.map((r) =>
        r.url === url ? { ...r, ...submitResult } : r
      ),
      updatedAt: new Date().toISOString(),
    }
    await storage.set(
      STORAGE_KEYS.LIBRARIAN_JOB_PREFIX + updatedJob.id,
      updatedJob
    )

    broadcastProgress({
      type: "librarian-progress",
      jobId: updatedJob.id,
      status: "submitting",
      completedCount: i + 1,
      totalCount: body.approvedUrls.length,
      results: updatedJob.results,
      message: `Submitted ${i + 1} of ${body.approvedUrls.length}…`,
    })
  }

  // Mark job done
  updatedJob = {
    ...updatedJob,
    status: "done",
    updatedAt: new Date().toISOString(),
  }
  await storage.set(STORAGE_KEYS.LIBRARIAN_JOB_PREFIX + updatedJob.id, updatedJob)

  const submittedCount = updatedJob.results.filter(
    (r) => r.status === "submitted"
  ).length

  broadcastProgress({
    type: "librarian-progress",
    jobId: updatedJob.id,
    status: "done",
    completedCount: submittedCount,
    totalCount: body.approvedUrls.length,
    results: updatedJob.results,
    message: `Done — ${submittedCount} application${submittedCount === 1 ? "" : "s"} submitted`,
  })

  res.send({ success: true })
}

export default handler
