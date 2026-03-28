import { Storage } from "@plasmohq/storage"
import { UserPersonaSchema } from "~types/librarian"
import { STORAGE_KEYS } from "~types/constants"
import type { UserPersona } from "~types/librarian"

const storage = new Storage({ area: "local" })

export class VaultLockedError extends Error {
  constructor() {
    super("Vault is locked — incorrect passphrase or vault is empty")
    this.name = "VaultLockedError"
  }
}

// ── Key Derivation ───────────────────────────────────────────────────────────

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 600_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

// ── Base64 Helpers ───────────────────────────────────────────────────────────

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypts and stores a UserPersona using AES-256-GCM.
 * On first call, generates and persists a random 16-byte salt.
 * On subsequent calls, reuses the existing salt (re-derives key with same passphrase).
 */
export async function vaultStore(
  persona: UserPersona,
  passphrase: string
): Promise<void> {
  // Generate or reuse salt
  let salt: Uint8Array
  const existingSalt = await storage.get<string>(STORAGE_KEYS.VAULT_SALT)
  if (existingSalt) {
    salt = fromBase64(existingSalt)
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16))
    await storage.set(STORAGE_KEYS.VAULT_SALT, toBase64(salt))
  }

  const key = await deriveKey(passphrase, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  const plaintext = encoder.encode(JSON.stringify(persona))

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  )

  // Storage layout: IV (12 bytes) || ciphertext+tag
  const payload = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  payload.set(iv, 0)
  payload.set(new Uint8Array(ciphertext), iv.byteLength)

  await storage.set(STORAGE_KEYS.VAULT_DATA, toBase64(payload))
}

/**
 * Decrypts and returns the stored UserPersona.
 * Throws VaultLockedError if passphrase is wrong or vault is empty.
 */
export async function vaultRetrieve(passphrase: string): Promise<UserPersona> {
  const saltB64 = await storage.get<string>(STORAGE_KEYS.VAULT_SALT)
  const dataB64 = await storage.get<string>(STORAGE_KEYS.VAULT_DATA)

  if (!saltB64 || !dataB64) {
    throw new VaultLockedError()
  }

  const salt = fromBase64(saltB64)
  const key = await deriveKey(passphrase, salt)

  const payload = fromBase64(dataB64)
  const iv = payload.slice(0, 12)
  const ciphertext = payload.slice(12)

  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    )
  } catch {
    // Wrong passphrase causes OperationError from WebCrypto
    throw new VaultLockedError()
  }

  const decoder = new TextDecoder()
  const json = decoder.decode(plaintext)
  return UserPersonaSchema.parse(JSON.parse(json))
}

/**
 * Returns true if a persona has been stored in the vault.
 */
export async function vaultExists(): Promise<boolean> {
  const data = await storage.get<string>(STORAGE_KEYS.VAULT_DATA)
  return !!data
}

/**
 * Removes all vault data from storage.
 */
export async function vaultClear(): Promise<void> {
  await storage.remove(STORAGE_KEYS.VAULT_SALT)
  await storage.remove(STORAGE_KEYS.VAULT_DATA)
}
