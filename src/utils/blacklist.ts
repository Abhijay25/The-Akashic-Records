import { BLACKLISTED_DOMAINS } from "~types/librarian"

/**
 * Returns true if the URL's hostname matches a blacklisted domain or any of its subdomains.
 * Malformed URLs are rejected (returns true — treated as blacklisted for safety).
 */
export function isBlacklisted(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return BLACKLISTED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    )
  } catch {
    return true
  }
}

/**
 * Partitions an array of URLs into allowed and blocked sets.
 * Used by the Librarian before the execution phase for logging/progress reporting.
 */
export function filterBlacklisted(urls: string[]): {
  allowed: string[]
  blocked: string[]
} {
  const allowed: string[] = []
  const blocked: string[] = []
  for (const url of urls) {
    if (isBlacklisted(url)) {
      blocked.push(url)
    } else {
      allowed.push(url)
    }
  }
  return { allowed, blocked }
}
