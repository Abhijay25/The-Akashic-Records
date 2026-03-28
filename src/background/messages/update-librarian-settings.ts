import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { LibrarianSettingsSchema, DEFAULT_LIBRARIAN_SETTINGS } from "~types/librarian"
import type { LibrarianSettings } from "~types/librarian"
import { STORAGE_KEYS } from "~types/constants"
import type { UpdateLibrarianSettingsRequest, UpdateLibrarianSettingsResponse } from "~types/messages"

const storage = new Storage({ area: "local" })

const handler: PlasmoMessaging.MessageHandler<
  UpdateLibrarianSettingsRequest,
  UpdateLibrarianSettingsResponse
> = async (req, res) => {
  if (!req.body?.settings) {
    res.send({ success: false, settings: DEFAULT_LIBRARIAN_SETTINGS, error: "Missing settings" })
    return
  }

  const stored = await storage.get<LibrarianSettings>(STORAGE_KEYS.LIBRARIAN_SETTINGS)
  const current = LibrarianSettingsSchema.parse(stored ?? DEFAULT_LIBRARIAN_SETTINGS)
  const merged = LibrarianSettingsSchema.parse({ ...current, ...req.body.settings })

  await storage.set(STORAGE_KEYS.LIBRARIAN_SETTINGS, merged)
  res.send({ success: true, settings: merged })
}

export default handler
