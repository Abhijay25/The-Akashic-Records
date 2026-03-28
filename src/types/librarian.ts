import { z } from "zod"

// ── Task Payload (discriminated union) ──────────────────────────────────────

const AdHocPayloadSchema = z.object({
  type: z.literal("AD_HOC_PROMPT"),
  prompt: z.string().min(1),
  maxResults: z.number().int().min(1).max(20).default(5),
})

const FeedBatchPayloadSchema = z.object({
  type: z.literal("FEED_BATCH"),
  urls: z.array(z.string().url()).min(1).max(50),
  sourceBookId: z.string().optional(),
})

export const TaskPayloadSchema = z.discriminatedUnion("type", [
  AdHocPayloadSchema,
  FeedBatchPayloadSchema,
])

export type TaskPayload = z.infer<typeof TaskPayloadSchema>

// ── Setup Persona Payload (one-time resume setup) ───────────────────────────

export const SetupPersonaPayloadSchema = z.object({
  resumeText: z.string().min(1),
  email: z.string().email(),
  passphrase: z.string().min(8),
})

export type SetupPersonaPayload = z.infer<typeof SetupPersonaPayloadSchema>

// ── UserPersona (LLM-parsed output from resume) ─────────────────────────────

export const UserPersonaSchema = z.object({
  personal: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string(),
    location: z.string(),
    linkedinUrl: z.string().url().optional(),
    githubUrl: z.string().url().optional(),
    portfolioUrl: z.string().url().optional(),
  }),
  summary: z.string(),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string(),
      startDate: z.string(),
      endDate: z.string().optional(),
      gpa: z.string().optional(),
      highlights: z.array(z.string()).optional(),
    })
  ),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string(),
      startDate: z.string(),
      endDate: z.string().optional(),
      description: z.string(),
      highlights: z.array(z.string()).optional(),
    })
  ),
  skills: z.object({
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    tools: z.array(z.string()),
    other: z.array(z.string()).optional(),
  }),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        url: z.string().url().optional(),
        technologies: z.array(z.string()),
      })
    )
    .optional(),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        issuer: z.string(),
        date: z.string(),
      })
    )
    .optional(),
})

export type UserPersona = z.infer<typeof UserPersonaSchema>

// ── LibrarianJob + ExecutionResult ──────────────────────────────────────────

export const LibrarianJobStatusSchema = z.enum([
  "idle",
  "scouting",
  "extracting",
  "executing",
  "awaiting_approval",
  "submitting",
  "done",
  "error",
])

export type LibrarianJobStatus = z.infer<typeof LibrarianJobStatusSchema>

export const ExecutionResultSchema = z.object({
  url: z.string().url(),
  status: z.enum(["filled", "submitted", "skipped", "error"]),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  error: z.string().optional(),
  filledAt: z.string().datetime().optional(),
  submittedAt: z.string().datetime().optional(),
})

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>

export const LibrarianJobSchema = z.object({
  id: z.string(),
  payload: TaskPayloadSchema,
  status: LibrarianJobStatusSchema,
  results: z.array(ExecutionResultSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  error: z.string().optional(),
})

export type LibrarianJob = z.infer<typeof LibrarianJobSchema>

// ── Blacklist ────────────────────────────────────────────────────────────────

export const BLACKLISTED_DOMAINS = [
  "mycareersfuture.gov.sg",
  "singpass.gov.sg",
] as const

// ── Mock Persona (NUS CS student @ ren EdTech) ───────────────────────────────

export const MOCK_PERSONA: UserPersona = {
  personal: {
    firstName: "Wei Jie",
    lastName: "Tan",
    email: "weijie.tan@u.nus.edu",
    phone: "+65 9123 4567",
    location: "Singapore",
    linkedinUrl: "https://linkedin.com/in/weijie-tan",
    githubUrl: "https://github.com/weijie-tan",
  },
  summary:
    "Penultimate Computer Science student at NUS with hands-on experience building full-stack EdTech products. Passionate about developer tooling and AI-powered applications.",
  education: [
    {
      institution: "National University of Singapore",
      degree: "Bachelor of Computing",
      field: "Computer Science",
      startDate: "2023-08",
      gpa: "4.5/5.0",
      highlights: [
        "Dean's List AY2023/24",
        "TA for CS2103T Software Engineering",
      ],
    },
  ],
  experience: [
    {
      company: "ren",
      title: "Software Engineering Intern",
      location: "Singapore",
      startDate: "2025-05",
      endDate: "2025-08",
      description:
        "Full-stack development for an EdTech startup building AI-powered learning tools.",
      highlights: [
        "Built React + TypeScript dashboard serving 2k+ students",
        "Designed Python FastAPI microservice for AI content generation",
        "Reduced page load time by 40% through code-splitting and caching",
      ],
    },
  ],
  skills: {
    languages: ["Python", "TypeScript", "JavaScript", "C++", "Java", "SQL"],
    frameworks: ["React", "Next.js", "FastAPI", "Express", "Tailwind CSS"],
    tools: ["Git", "Docker", "PostgreSQL", "Redis", "AWS (S3, Lambda)"],
    other: ["Agile/Scrum", "CI/CD", "REST API Design"],
  },
  projects: [
    {
      name: "The Akashic Records",
      description:
        "Agentic Chrome extension that generates curated intelligence feeds from natural language prompts.",
      url: "https://github.com/weijie-tan/akashic-records",
      technologies: ["TypeScript", "React", "Plasmo", "TinyFish SDK", "OpenAI"],
    },
  ],
}
