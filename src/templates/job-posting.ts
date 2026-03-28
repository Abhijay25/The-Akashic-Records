import type { FeedTemplate } from "./types"

const jobPosting: FeedTemplate = {
  id: "job-posting",
  name: "Job Postings",

  triggerKeywords: [
    "job",
    "jobs",
    "hiring",
    "career",
    "careers",
    "role",
    "position",
    "openings",
    "recruit",
    "vacancy",
    "internship",
    "full-time",
    "part-time",
    "remote",
    "salary",
    "engineer",
    "developer",
    "analyst",
    "manager"
  ],

  tinyfishGoal: `Extract the following job posting fields from this page and return as JSON:
{
  "jobTitle": "exact job title as listed",
  "company": "company or organization name",
  "location": "city, country, or 'Remote' / 'Hybrid'",
  "employmentType": "Full-time / Part-time / Contract / Internship / Freelance, or null",
  "salary": "salary range or compensation details as shown, or null",
  "duration": "contract length or 'Permanent', or null",
  "description": "full job description text",
  "requirements": "full requirements and qualifications text",
  "applicationDeadline": "closing date if listed, or null",
  "postedDate": "date the job was posted, or null"
}
Extract full text verbatim. Do not summarize.`,

  parseSystemPrompt: `You receive raw extracted job posting data as JSON. Format it into a structured Chapter.

Return ONLY valid JSON:
{
  "title": "<jobTitle> at <company>",
  "content": "<formatted markdown>"
}

For content, use this exact structure:

## [jobTitle]
**Company:** [company]
**Location:** [location]
**Type:** [employmentType or "Not specified"]
**Salary:** [salary or "Not disclosed"]
**Duration:** [duration or "Not specified"]
**Posted:** [postedDate or "N/A"] | **Deadline:** [applicationDeadline or "Rolling"]

---

## About the Role
[description — full text, use markdown bullet points where the original uses lists]

## Requirements
[requirements — full text, preserve any bullet lists]

Rules:
- Preserve all detail from the original posting
- If a field is null, use the fallback shown in brackets
- Do not add your own assessment or commentary`
}

export default jobPosting
