import { TinyFish, BrowserProfile, RunStatus } from "@tiny-fish/sdk"
import type { FeedProgressEvent } from "~types/messages"

const client = new TinyFish({
  apiKey: process.env.PLASMO_PUBLIC_TINYFISH_API_KEY ?? ""
})

export interface TinyFishResult {
  content: string
  success: boolean
}

/**
 * Uses TinyFish to extract full article content from a URL via SSE streaming.
 * Emits progress events via onProgress as the stream arrives.
 */
export async function runTinyFish({
  url,
  goal,
  browserProfile = "lite",
  onProgress
}: {
  url: string
  goal: string
  browserProfile?: "lite" | "full"
  onProgress?: (event: Partial<FeedProgressEvent>) => void
}): Promise<TinyFishResult> {
  try {
    const profile = browserProfile === "full" ? BrowserProfile.STEALTH : BrowserProfile.LITE

    const stream = await client.agent.stream({ goal, url, browser_profile: profile })

    let resultContent = ""

    for await (const event of stream) {
      if (event.type === "PROGRESS") {
        onProgress?.({ message: `[TinyFish] ${event.purpose}` })
      } else if (event.type === "COMPLETE") {
        if (event.status === RunStatus.COMPLETED && event.result) {
          // Result is a structured JSON object — serialize to string for LLM parsing
          resultContent = JSON.stringify(event.result, null, 2)
        } else if (event.error) {
          console.warn("[tinyfish] run failed:", event.error.message)
          return { content: "", success: false }
        }
      }
    }

    if (!resultContent.trim()) {
      return { content: "", success: false }
    }

    return { content: resultContent, success: true }
  } catch (err) {
    console.error("[tinyfish] extraction failed for", url, err)
    return { content: "", success: false }
  }
}
