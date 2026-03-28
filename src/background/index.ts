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

// MV3 service workers are killed after ~30s of inactivity.
// Create the alarm on every SW startup (top-level) so it's always active,
// regardless of whether onInstalled or onStartup fired.
chrome.alarms.create("sw-keepalive", { periodInMinutes: 1 / 3 }) // ~20s

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sw-keepalive") {
    // No-op — waking up is enough to reset the idle timer
  }
})

export {}
