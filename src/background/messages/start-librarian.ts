import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { runLibrarian } from "~agents/librarian"
import { TaskPayloadSchema, LibrarianSettingsSchema, DEFAULT_LIBRARIAN_SETTINGS } from "~types/librarian"
import type { LibrarianSettings } from "~types/librarian"
import { STORAGE_KEYS } from "~types/constants"
import { broadcastProgress } from "~background/ports/agent-status"
import type { StartLibrarianRequest, StartLibrarianResponse } from "~types/messages"

const storage = new Storage({ area: "local" })

const handler: PlasmoMessaging.MessageHandler<
  StartLibrarianRequest,
  StartLibrarianResponse
> = async (req, res) => {
  const body = req.body

  if (!body?.payload) {
    res.send({ jobId: "", error: "Missing payload" })
    return
  }

  const parseResult = TaskPayloadSchema.safeParse(body.payload)
  if (!parseResult.success) {
    res.send({ jobId: "", error: parseResult.error.message })
    return
  }

  const stored = await storage.get<LibrarianSettings>(STORAGE_KEYS.LIBRARIAN_SETTINGS)
  const settings = LibrarianSettingsSchema.parse(stored ?? DEFAULT_LIBRARIAN_SETTINGS)

  let jobId = ""

  await new Promise<void>((resolve) => {
    let resolved = false

    const jobPromise = runLibrarian(
      parseResult.data,
      (event) => {
        broadcastProgress(event)
        if (!resolved) {
          jobId = event.jobId
          resolved = true
          resolve()
        }
      },
      { requireHitl: settings.requireHitl }
    )

    // Safety fallback: unblock if first progress event takes >3s
    setTimeout(resolve, 3000)

    jobPromise.catch((err) => {
      console.error("[start-librarian] pipeline error:", err)
      if (jobId) {
        broadcastProgress({
          type: "librarian-progress",
          jobId,
          status: "error",
          completedCount: 0,
          totalCount: 0,
          results: [],
          message: String(err),
        })
      }
      if (!resolved) {
        resolved = true
        resolve()
      }
    })
  })

  res.send(
    jobId
      ? { jobId }
      : {
          jobId: "",
          error: "Pipeline failed to start. Check API keys and the extension console.",
        }
  )
}

export default handler
