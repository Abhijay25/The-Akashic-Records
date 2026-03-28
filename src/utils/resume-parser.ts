import OpenAI from "openai"
import { UserPersonaSchema } from "~types/librarian"
import type { UserPersona } from "~types/librarian"

const client = new OpenAI({
  apiKey: process.env.PLASMO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

const RESUME_SYSTEM_PROMPT = `You are a resume parser. Extract structured data from the provided resume text.
Return ONLY valid JSON matching this exact schema:
{
  "personal": { "firstName": "", "lastName": "", "email": "", "phone": "", "location": "", "linkedinUrl": "", "githubUrl": "", "portfolioUrl": "" },
  "summary": "professional summary or first paragraph",
  "education": [{ "institution": "", "degree": "", "field": "", "startDate": "YYYY-MM", "endDate": "YYYY-MM", "gpa": "", "highlights": [] }],
  "experience": [{ "company": "", "title": "", "location": "", "startDate": "YYYY-MM", "endDate": "YYYY-MM", "description": "", "highlights": [] }],
  "skills": { "languages": [], "frameworks": [], "tools": [], "other": [] },
  "projects": [{ "name": "", "description": "", "url": "", "technologies": [] }],
  "certifications": [{ "name": "", "issuer": "", "date": "YYYY-MM" }]
}

Rules:
- Use the provided email address for personal.email (override any email in the resume)
- Dates as "YYYY-MM" format
- If a field cannot be extracted, use reasonable defaults (empty arrays, "Not specified")
- Omit optional top-level fields (projects, certifications) if none found
- Do not invent information — only extract what is in the resume
- Optional URL fields (linkedinUrl, githubUrl, portfolioUrl) should be omitted if not found`

/**
 * Parses raw resume text + email into a structured UserPersona using GPT-4o-mini.
 * Retries once with a stricter prompt on parse/validation failure.
 * Throws if both attempts fail.
 */
export async function parseResume(
  resumeText: string,
  email: string
): Promise<UserPersona> {
  const userMessage = `Email to use: ${email}\n\nResume:\n${resumeText}`

  const attempt = async (strict: boolean): Promise<UserPersona | null> => {
    const sysMsg = strict
      ? RESUME_SYSTEM_PROMPT +
        "\n\nCRITICAL: Return ONLY the JSON object. No markdown, no prose, no code fences."
      : RESUME_SYSTEM_PROMPT

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sysMsg },
          { role: "user", content: userMessage.slice(0, 12000) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      })

      const raw = completion.choices[0]?.message?.content
      if (!raw) return null

      return UserPersonaSchema.parse(JSON.parse(raw))
    } catch (err) {
      console.warn("[resume-parser] attempt failed:", err)
      return null
    }
  }

  const result = await attempt(false)
  if (result) return result

  const retry = await attempt(true)
  if (retry) return retry

  throw new Error(
    "Resume parsing failed after two attempts. Please check the resume text and try again."
  )
}
