import type { PlasmoMessaging } from "@plasmohq/messaging"

// This port handler is registered so Plasmo recognizes "agent-status" as a valid port.
// Actual message pushing happens in start-feed.ts via chrome.runtime.onConnect.
// The port stays open as long as the popup is open; background pushes FeedProgressEvents.

const handler: PlasmoMessaging.PortHandler = async (req, res) => {
  // Keep the port open — background pushes to it, this handler doesn't need to send.
  // Plasmo will call this when a message arrives on the port (client → background direction).
  // We don't expect inbound messages on this port.
}

export default handler
