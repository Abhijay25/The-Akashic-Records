import type { PlasmoMessaging } from "@plasmohq/messaging"
import { runLibrarian } from "~agents/librarian"
import { TaskPayloadSchema } from "~types/librarian"
import { vaultExists } from "~utils/vault"
import { broadcastProgress } from "~background/ports/agent-status"
import type { StartLibrarianRequest, StartLibrarianResponse } from "~types/messages"

const handler: PlasmoMessaging.MessageHandler<
  StartLibrarianRequest,
  StartLibrarianResponse
> = async (req, res) => {
  const body = req.body

  if (!body?.payload || !body?.passphrase) {
    res.send({ jobId: "", error: "Missing payload or passphrase" })
    return
  }

  const parseResult = TaskPayloadSchema.safeParse(body.payload)
  if (!parseResult.success) {
    res.send({ jobId: "", error: parseResult.error.message })
    return
  }

  const hasPersona = await vaultExists()
  if (!hasPersona) {
    res.send({
      jobId: "",
      error: "No persona stored. Set up your profile first.",
    })
    return
  }

  let jobId = ""

  await new Promise<void>((resolve) => {
    let resolved = false

    const jobPromise = runLibrarian(
      parseResult.data,
      body.passphrase,
      (event) => {
        broadcastProgress(event)
        if (!resolved) {
          jobId = event.jobId
          resolved = true
          resolve()
        }
      }
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

  res.send({ jobId })
}

export default handler
