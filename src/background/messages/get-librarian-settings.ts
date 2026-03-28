import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { LibrarianSettingsSchema, DEFAULT_LIBRARIAN_SETTINGS } from "~types/librarian"
import type { LibrarianSettings } from "~types/librarian"
import { STORAGE_KEYS } from "~types/constants"
import type { GetLibrarianSettingsResponse } from "~types/messages"

const storage = new Storage({ area: "local" })

const handler: PlasmoMessaging.MessageHandler<
  never,
  GetLibrarianSettingsResponse
> = async (_req, res) => {
  const stored = await storage.get<LibrarianSettings>(STORAGE_KEYS.LIBRARIAN_SETTINGS)
  const settings = LibrarianSettingsSchema.parse(stored ?? DEFAULT_LIBRARIAN_SETTINGS)
  res.send({ settings })
}

export default handler
