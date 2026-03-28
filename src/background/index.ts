// Service worker entry point for The Akashic Records
// Plasmo automatically registers message/port handlers via file-system conventions.
// This file handles any global initialization.

import { Storage } from "@plasmohq/storage"
import { STORAGE_KEYS } from "~types/constants"

const storage = new Storage({ area: "local" })

// Ensure the book index exists on first install
chrome.runtime.onInstalled.addListener(async () => {
  const index = await storage.get(STORAGE_KEYS.BOOK_INDEX)
  if (!index) {
    await storage.set(STORAGE_KEYS.BOOK_INDEX, [])
  }
})

export {}
