import type { PlasmoMessaging } from "@plasmohq/messaging"
import { runThreatSentry } from "~agents/threat-sentry"
import { FeedConfigSchema } from "~types/book"
import { PORT_NAMES } from "~types/constants"
import type { StartFeedRequest, StartFeedResponse, FeedProgressEvent } from "~types/messages"

// Active ports indexed by portId (Plasmo manages port lifecycle)
const activePorts = new Map<string, chrome.runtime.Port>()

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === PORT_NAMES.AGENT_STATUS) {
    const portId = Math.random().toString(36).slice(2)
    activePorts.set(portId, port)
    port.onDisconnect.addListener(() => activePorts.delete(portId))
  }
})

function broadcastProgress(event: FeedProgressEvent): void {
  for (const port of activePorts.values()) {
    try {
      port.postMessage(event)
    } catch {
      // Port may have disconnected between check and send; ignore
    }
  }
}

const handler: PlasmoMessaging.MessageHandler<StartFeedRequest, StartFeedResponse> = async (
  req,
  res
) => {
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

  try {
    // Kick off the pipeline; send bookId back immediately via the first progress event
    // We run async and return the bookId right away so the popup doesn't hang
    const bookPromise = runThreatSentry(config, (event) => {
      if (!bookId) bookId = event.bookId
      broadcastProgress(event)
    })

    // Wait briefly for the book ID to be set by the first progress emit
    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (bookId) {
          clearInterval(poll)
          resolve()
        }
      }, 10)
      // Safety timeout: if no progress in 2s, generate an ID ourselves
      setTimeout(() => {
        clearInterval(poll)
        resolve()
      }, 2000)
    })

    // Don't await bookPromise here — let it run in background
    bookPromise.catch((err) => {
      console.error("[start-feed] pipeline failed:", err)
      if (bookId) {
        broadcastProgress({
          type: "feed-progress",
          bookId,
          status: "error",
          entriesCount: 0,
          message: String(err)
        })
      }
    })

    res.send({ bookId })
  } catch (err) {
    console.error("[start-feed] handler error:", err)
    res.send({ bookId: "", error: String(err) })
  }
}

export default handler
