import type { FeedTemplate } from "./types"

const cve: FeedTemplate = {
  id: "cve",
  name: "Security Advisories & CVEs",

  triggerKeywords: [
    "cve",
    "vulnerability",
    "vulnerabilities",
    "exploit",
    "zero-day",
    "0day",
    "patch",
    "advisory",
    "security",
    "breach",
    "malware",
    "ransomware",
    "threat",
    "disclosure",
    "nvd",
    "nist",
    "cvss"
  ],

  tinyfishGoal: `Extract the following security advisory fields from this page and return as JSON:
{
  "cveId": "CVE identifier (e.g. CVE-2024-12345), or null",
  "cvssScore": "CVSS score as a number (e.g. 9.8), or null",
  "severity": "severity rating: Critical / High / Medium / Low, or null",
  "affectedProducts": "list of affected software, products, or versions as a string",
  "description": "full technical description of the vulnerability",
  "remediation": "patch, workaround, or mitigation details, or null",
  "publishedDate": "disclosure or publication date, or null",
  "source": "source organization or publication name"
}
Extract verbatim. Do not summarize or omit technical details.`,

  parseSystemPrompt: `You receive raw extracted CVE/security advisory data as JSON. Format it into a structured Chapter.

Return ONLY valid JSON:
{
  "title": "<CVE ID if present, otherwise short vulnerability title>: <one-line description>",
  "content": "<formatted markdown>"
}

For content, use this exact structure:

## Vulnerability Summary
| Field | Value |
|-------|-------|
| **CVE ID** | [cveId or N/A] |
| **CVSS Score** | [cvssScore — e.g. 9.8 (Critical)] |
| **Severity** | [severity] |
| **Published** | [publishedDate or N/A] |
| **Source** | [source] |

## Affected Products
[affectedProducts — use a bullet list if multiple]

## Description
[description — full technical detail, no summarization]

## Remediation
[remediation — or "No patch available at time of publication." if null]

Rules:
- Keep all technical identifiers and version numbers exact
- Do not add analysis or opinions
- If a field is null, use "N/A"`
}

export default cve
