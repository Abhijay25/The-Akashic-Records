import { TinyFish, BrowserProfile, RunStatus } from "@tiny-fish/sdk"
import { isBlacklisted } from "~utils/blacklist"
import { getKnownBrokerName } from "~types/librarian"
import type { UserPersona, ExecutionResult } from "~types/librarian"

const client = new TinyFish({
  apiKey: process.env.PLASMO_PUBLIC_TINYFISH_API_KEY ?? "",
})
const STEALTH_TIMEOUT_MS = 90_000

// ── Goal Prompts ─────────────────────────────────────────────────────────────

function buildFormFillGoal(persona: UserPersona): string {
  return `You are an automated job application assistant. Navigate this ATS (Applicant Tracking System) form and fill it out completely using the provided applicant data.

APPLICANT DATA:
${JSON.stringify(persona, null, 2)}

INSTRUCTIONS:
1. Map applicant data to form fields (name, email, phone, education, experience, skills, etc.)
2. Skip file upload fields (resume/CV) — do not attempt file uploads.
3. For LEGAL/COMPLIANCE questions (criminal history, right to work, disability, veteran status, drug testing, background checks, etc.): always select the SAFEST/most favorable option. Examples: "No" for criminal history, "Yes" for right to work, "Prefer not to say" for disability/veteran status, "Yes" for willingness to undergo background checks.
4. For SHORT ANSWER / FREE TEXT fields (e.g. "Why do you want to work here?", "Cover letter", "Additional information"): write a professional, concise answer (2-4 sentences) drawing on the applicant's experience and skills from the provided data. Tailor it to the job/company if visible on the page.
5. For dropdown/select fields with no exact match, pick the closest reasonable option.
6. Navigate through ALL form pages/steps — if the form is multi-page, continue to each step.
7. Before stopping: VERIFY all mandatory/required fields (marked with * or "required") are filled. If any mandatory field is empty and you cannot determine the answer, fill it with a reasonable default from the applicant data or "Not applicable".
8. CRITICAL: After filling ALL fields on ALL pages, STOP. Do NOT click the final Submit/Apply button. Leave the form in a filled-but-not-submitted state.
9. Return JSON:
   {
     "fieldsFilledCount": <number of fields filled>,
     "mandatoryFieldsCount": <number of mandatory fields found>,
     "mandatoryFieldsFilled": <number of mandatory fields successfully filled>,
     "formPages": <number of form pages navigated>,
     "readyToSubmit": <true if all mandatory fields are filled>,
     "shortAnswersGenerated": <number of free-text answers generated>,
     "notes": "<any issues encountered, fields that couldn't be filled, etc.>"
   }`
}

const EXTRACT_ATS_LINK_GOAL = `Extract the external application URL from this LinkedIn job posting page.
Look for the "Apply" button — it should redirect to an external ATS portal (e.g., Workday, Greenhouse, Lever, iCIMS, Taleo).
Do NOT click "Easy Apply" — that requires LinkedIn login.
If the job only has "Easy Apply" with no external link, return atsUrl as null.

Return JSON: { "atsUrl": "<external application URL or null>", "jobTitle": "<job title>", "company": "<company name>" }`

const SUBMIT_FORM_GOAL = `Navigate to the application form on this page and click the final Submit/Apply button to complete the submission. The form should already be filled — your only task is to find and click the submit button.`

function buildDataBrokerOptOutGoal(persona: UserPersona): string {
  return `You are a privacy assistant helping a user submit a data-broker opt-out or removal request.

USER DATA:
${JSON.stringify(
    {
      firstName: persona.personal.firstName,
      lastName: persona.personal.lastName,
      email: persona.personal.email,
      phone: persona.personal.phone,
      location: persona.personal.location,
    },
    null,
    2
  )}

INSTRUCTIONS:
1. Find the site's privacy, suppression, removal, or opt-out request flow.
2. Navigate to the correct form or request page.
3. Fill the request using the provided user data.
4. If the site asks for a profile/listing URL, search the page for the best matching field and populate it only if you can infer it from the current site. Otherwise leave it blank and mention it in notes.
5. If there are checkboxes or confirmation prompts required to proceed, complete them.
6. STOP before the final submit/remove button. Leave the request ready for user review.
7. Return ONLY JSON:
{
  "fieldsFilledCount": <number>,
  "mandatoryFieldsCount": <number>,
  "mandatoryFieldsFilled": <number>,
  "formPages": <number>,
  "readyToSubmit": <boolean>,
  "shortAnswersGenerated": <number>,
  "notes": "<brief notes about what was filled or any blockers>"
}`
}

// ── Internal Stream Runner ───────────────────────────────────────────────────

interface TinyFishRawResult {
  content: string
  success: boolean
}

async function runStealth(
  url: string,
  goal: string,
  onProgress?: (message: string) => void
): Promise<TinyFishRawResult> {
  try {
    const runTask = async (): Promise<TinyFishRawResult> => {
      const stream = await client.agent.stream({
        goal,
        url,
        browser_profile: BrowserProfile.STEALTH,
      })

      let resultContent = ""

      for await (const event of stream) {
        if (event.type === "PROGRESS") {
          onProgress?.(event.purpose)
        } else if (event.type === "COMPLETE") {
          if (event.status === RunStatus.COMPLETED && event.result) {
            resultContent = JSON.stringify(event.result, null, 2)
          } else if (event.error) {
            console.warn("[tinyfish-execute] run failed:", event.error.message)
            return { content: "", success: false }
          }
        }
      }

      return { content: resultContent.trim(), success: !!resultContent.trim() }
    }

    const timeoutTask = new Promise<TinyFishRawResult>((resolve) => {
      setTimeout(() => {
        console.warn(`[tinyfish-execute] stealth run timed out after ${STEALTH_TIMEOUT_MS}ms for`, url)
        resolve({ content: "", success: false })
      }, STEALTH_TIMEOUT_MS)
    })

    return await Promise.race([runTask(), timeoutTask])
  } catch (err) {
    console.error("[tinyfish-execute] stream error for", url, err)
    return { content: "", success: false }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface FormFillResult {
  fieldsFilledCount: number
  mandatoryFieldsCount: number
  mandatoryFieldsFilled: number
  formPages: number
  readyToSubmit: boolean
  shortAnswersGenerated: number
  notes: string
}

export interface ExtractAtsResult {
  atsUrl: string | null
  jobTitle: string
  company: string
}

/**
 * Fills an ATS form using TinyFish STEALTH.
 * Does NOT click submit — leaves form in filled-but-not-submitted state.
 * Returns an ExecutionResult with status "filled" or "error".
 */
export async function executeTinyFishForm({
  url,
  persona,
  onProgress,
}: {
  url: string
  persona: UserPersona
  onProgress?: (message: string) => void
}): Promise<ExecutionResult> {
  if (isBlacklisted(url)) {
    return {
      url,
      status: "skipped",
      error: "URL is on the blacklist",
    }
  }

  const goal = buildFormFillGoal(persona)
  const { content, success } = await runStealth(url, goal, onProgress)

  if (!success) {
    return {
      url,
      status: "error",
      error: "TinyFish failed to execute form-filling",
    }
  }

  let parsed: FormFillResult
  try {
    parsed = JSON.parse(content) as FormFillResult
  } catch {
    return {
      url,
      status: "error",
      error: "Failed to parse TinyFish result JSON",
    }
  }

  if (!parsed.readyToSubmit) {
    return {
      url,
      status: "error",
      error: `Form not ready to submit. Notes: ${parsed.notes}`,
      filledAt: new Date().toISOString(),
    }
  }

  return {
    url,
    status: "filled",
    filledAt: new Date().toISOString(),
  }
}

/**
 * Navigates to a broker removal page and prepares the opt-out request.
 * Stops before the final submit so the user can review first.
 */
export async function executeDataBrokerOptOut({
  url,
  persona,
  onProgress,
}: {
  url: string
  persona: UserPersona
  onProgress?: (message: string) => void
}): Promise<ExecutionResult> {
  const goal = buildDataBrokerOptOutGoal(persona)
  const { content, success } = await runStealth(url, goal, onProgress)

  if (!success) {
    return {
      url,
      status: "error",
      error: "TinyFish failed to prepare opt-out request",
    }
  }

  let parsed: FormFillResult
  try {
    parsed = JSON.parse(content) as FormFillResult
  } catch {
    return {
      url,
      status: "error",
      error: "Failed to parse TinyFish opt-out result JSON",
    }
  }

  if (!parsed.readyToSubmit) {
    return {
      url,
      status: "error",
      error: `Opt-out form not ready to submit. Notes: ${parsed.notes}`,
      filledAt: new Date().toISOString(),
    }
  }

  return {
    url,
    status: "filled",
    company: getKnownBrokerName(url) ?? new URL(url).hostname,
    filledAt: new Date().toISOString(),
  }
}

/**
 * Extracts the external ATS application URL from a LinkedIn job posting page.
 * Uses TinyFish LITE (public pages, no login needed).
 * Returns null for atsUrl if only Easy Apply is available.
 */
export async function extractAtsLink(linkedinUrl: string): Promise<ExtractAtsResult> {
  const { content, success } = await runStealth(linkedinUrl, EXTRACT_ATS_LINK_GOAL)

  if (!success) {
    return { atsUrl: null, jobTitle: "", company: "" }
  }

  try {
    return JSON.parse(content) as ExtractAtsResult
  } catch {
    return { atsUrl: null, jobTitle: "", company: "" }
  }
}

/**
 * Submits an already-filled ATS form by clicking the Submit/Apply button.
 * Called after HITL approval. Returns ExecutionResult with status "submitted" or "error".
 */
export async function submitFilledForm(url: string): Promise<ExecutionResult> {
  if (isBlacklisted(url)) {
    return {
      url,
      status: "skipped",
      error: "URL is on the blacklist",
    }
  }

  const { success } = await runStealth(url, SUBMIT_FORM_GOAL)

  if (!success) {
    return {
      url,
      status: "error",
      error: "TinyFish failed to submit form",
    }
  }

  return {
    url,
    status: "submitted",
    submittedAt: new Date().toISOString(),
  }
}
