import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { FeedProgressEvent, LibrarianProgressEvent } from "~types/messages"

/**
 * Registry of active push functions, one per connected popup instance.
 * Keyed by a random ID assigned on connect so we can remove on disconnect.
 *
 * start-feed.ts and librarian.ts call broadcastProgress() which fans out to all active ports.
 * This works because all background modules share the same service worker scope.
 * Discriminated on event.type: "feed-progress" | "librarian-progress".
 */
type ProgressEvent = FeedProgressEvent | LibrarianProgressEvent

const activeSenders = new Map<string, (event: ProgressEvent) => void>()

export function broadcastProgress(event: ProgressEvent): void {
  for (const send of activeSenders.values()) {
    send(event)
  }
}

const handler: PlasmoMessaging.PortHandler<never, ProgressEvent> = async (
  req,
  res
) => {
  const id = crypto.randomUUID()
  activeSenders.set(id, (event) => res.send(event))

  // Clean up when the port disconnects (popup closes or navigates away)
  req.port.onDisconnect.addListener(() => {
    activeSenders.delete(id)
  })

  // Port stays open — background pushes events, popup never sends on this port
}

export default handler
