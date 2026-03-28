import type { FeedTemplate } from "./types"

const jobPosting: FeedTemplate = {
  id: "job-posting",
  name: "Job Postings",

  triggerKeywords: [
    "job posting",
    "job listing",
    "job opening",
    "hiring",
    "career opportunity",
    "careers page",
    "we're hiring",
    "apply now",
    "job application",
    "vacancy",
    "internship",
    "full-time position",
    "part-time position",
    "job description",
    "work at"
  ],

  tinyfishGoal: `Extract the following job posting fields from this page and return as JSON:
{
  "jobTitle": "exact job title as listed",
  "company": "company or organization name",
  "location": "city, country, or 'Remote' / 'Hybrid'",
  "employmentType": "Full-time / Part-time / Contract / Internship / Freelance, or null",
  "salary": "salary range or compensation details as shown, or null",
  "benefits": "benefits summary (e.g. health insurance, 401k, equity), or null",
  "description": "full job description text",
  "requirements": "full requirements and qualifications text",
  "applicationUrl": "direct application URL or null",
  "applicationDeadline": "closing date if listed, or null",
  "postedDate": "date the job was posted, or null"
}
Extract full text verbatim. Do not summarize.`,

  parseSystemPrompt: `You receive raw extracted job posting data as JSON. Format it into a structured Chapter.

Return ONLY valid JSON:
{
  "title": "<jobTitle> at <company>",
  "content": "<formatted markdown>",
  "metadata": {
    "jobTitle": "<job title>",
    "company": "<company>",
    "location": "<location>",
    "employmentType": "<type or null>",
    "salary": "<salary or null>",
    "applicationUrl": "<URL or null>",
    "applicationDeadline": "<deadline or null>",
    "postedDate": "<date or null>"
  }
}

For content, use this exact structure:
**Company:** [company] | **Location:** [location] | **Type:** [employmentType]
**Salary:** [salary or "Not disclosed"] | **Posted:** [postedDate] | **Deadline:** [applicationDeadline or "Rolling"]

---

[description — full job description text verbatim]

## Requirements
[requirements — full text verbatim, preserving bullet lists]

Rules:
- Preserve all detail from the original posting
- If a field is null, use the fallback shown in brackets for markdown, null in metadata
- Do not add your own assessment or commentary`
}

export default jobPosting
