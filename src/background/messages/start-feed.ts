import type { PlasmoMessaging } from "@plasmohq/messaging"
import { runThreatSentry } from "~agents/threat-sentry"
import { FeedConfigSchema } from "~types/book"
import { broadcastProgress } from "~background/ports/agent-status"
import type { StartFeedRequest, StartFeedResponse } from "~types/messages"

const handler: PlasmoMessaging.MessageHandler<
  StartFeedRequest,
  StartFeedResponse
> = async (req, res) => {
  const body = req.body

  if (!body?.config) {
    res.send({ bookId: "", error: "Missing config" })
    return
  }

  const parseResult = FeedConfigSchema.safeParse(body.config)
  if (!parseResult.success) {
    res.send({ bookId: "", error: parseResult.error.message })
    return
  }

  const config = parseResult.data
  let bookId = ""

  // Wait for the first progress event to get the bookId, then return it
  // immediately so the popup can show a loading state. Pipeline continues async.
  await new Promise<void>((resolve) => {
    let resolved = false

    const bookPromise = runThreatSentry(config, (event) => {
      broadcastProgress(event)
      if (!resolved) {
        bookId = event.bookId
        resolved = true
        resolve()
      }
    })

    // Safety fallback: if the first progress event takes >3s, unblock anyway
    setTimeout(resolve, 3000)

    bookPromise.catch((err) => {
      console.error("[start-feed] pipeline error:", err)
      if (bookId) {
        broadcastProgress({
          type: "feed-progress",
          bookId,
          status: "error",
          chaptersCount: 0,
          message: String(err)
        })
      }
      if (!resolved) {
        resolved = true
        resolve()
      }
    })
  })

  res.send({ bookId })
}

export default handler
