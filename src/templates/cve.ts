import type { FeedTemplate } from "./types"

const cve: FeedTemplate = {
  id: "cve",
  name: "Security Advisories & CVEs",

  triggerKeywords: [
    "cve",
    "cve-",
    "vulnerability",
    "vulnerabilities",
    "exploit",
    "zero-day",
    "0day",
    "security advisory",
    "security patch",
    "security bulletin",
    "malware",
    "ransomware",
    "threat intelligence",
    "nvd",
    "nist",
    "cvss",
    "cwe",
    "remote code execution",
    "privilege escalation",
    "buffer overflow"
  ],

  tinyfishGoal: `Extract the following security advisory fields from this page and return as JSON:
{
  "cveId": "CVE identifier (e.g. CVE-2024-12345), or null",
  "cvssScore": "CVSS score as a number (e.g. 9.8), or null",
  "severity": "severity rating: Critical / High / Medium / Low, or null",
  "affectedProducts": "list of affected software, products, or versions as a string",
  "remediation": "patch, workaround, or mitigation details, or null",
  "publishedDate": "disclosure or publication date, or null",
  "source": "source organization or publication name",
  "body": "complete page text preserving all paragraphs and technical detail"
}
Extract verbatim. Do not summarize or omit technical details.`,

  parseSystemPrompt: `You receive raw extracted CVE/security advisory data as JSON. Format it into a structured Chapter.

Return ONLY valid JSON:
{
  "title": "<CVE ID if present, otherwise short vulnerability title>: <one-line description>",
  "content": "<formatted markdown>",
  "metadata": {
    "cveId": "<CVE ID or null>",
    "cvssScore": "<score as number or null>",
    "severity": "<Critical/High/Medium/Low or null>",
    "affectedProducts": "<affected products string or null>",
    "hasRemediation": <true if remediation info exists, false otherwise>,
    "publishedDate": "<date or null>",
    "source": "<source or null>"
  }
}

For content, use this exact structure:
**CVE:** [cveId] | **CVSS:** [cvssScore] ([severity]) | **Published:** [publishedDate]
**Affected:** [affectedProducts] | **Source:** [source]
**Remediation:** [remediation or "None available"]

---

[body — full article/advisory text verbatim, preserving all paragraphs and technical detail]

Rules:
- Keep all technical identifiers and version numbers exact
- Do not add analysis or opinions
- If a field is null, use "N/A" in the markdown header but null in metadata`
}

export default cve
