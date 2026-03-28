/**
 * seed-demo.js — Pre-load demo data into the extension's chrome.storage.local
 *
 * HOW TO USE:
 *   1. Go to brave://extensions (or chrome://extensions)
 *   2. Find "The Akashic Records" → click "Service Worker" (inspect link)
 *   3. In the console that opens, paste this entire script and press Enter
 *   4. Reload the extension popup — the History sidebar will show 3 seeded searches
 */

;(async () => {
  const now = new Date().toISOString()
  const ago = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString()

  // ── Book 1: AI Agents ────────────────────────────────────────────────────────
  const book1Id = "demo-book-ai-agents"
  const book1 = {
    id: book1Id,
    prompt: "latest developments in AI agents",
    templateId: "news",
    status: "done",
    chapters: [
      {
        id: "ch-1a",
        title: "OpenAI Launches GPT-4o with Real-Time Tool Use",
        content:
          "## Overview\nOpenAI's GPT-4o introduces native tool-use capabilities that let agents browse the web, run code, and manage files in a single model call — eliminating the latency overhead of separate orchestration loops.\n\n## Key Points\n- **Tool parallelism**: GPT-4o can invoke multiple tools in a single forward pass\n- **Latency**: Average tool round-trip reduced from 2.4s to 0.6s in benchmarks\n- **Safety**: New refusal layer blocks tool chains that would exfiltrate user data\n\n## Why It Matters\nAgents built on GPT-4o can now handle multi-step workflows — from searching a database to writing and executing a Python script — without human hand-holding between steps.",
        metadata: { category: "AI Research", sentiment: "positive" },
        sourceUrl: "https://openai.com/research/gpt-4o-tool-use",
        scrapedAt: ago(30),
      },
      {
        id: "ch-1b",
        title: "Anthropic's Claude 3.5 Sonnet Sets New Agentic Benchmark",
        content:
          "## Overview\nClaude 3.5 Sonnet scored 71.1% on SWE-bench Verified, the industry's toughest software-engineering agent benchmark — up from 49% for Claude 3 Opus.\n\n## Key Points\n- **SWE-bench**: 71.1% pass rate resolving real GitHub issues end-to-end\n- **Computer use**: Claude can now operate a virtual desktop, clicking, typing, and navigating UIs\n- **Prompt caching**: 90% cost reduction on repeated context, critical for long agentic loops\n\n## Why It Matters\nThe leap from ~50% to 71% represents a qualitative shift: agents can now reliably complete senior-engineer-level tasks with minimal scaffolding.",
        metadata: { category: "AI Research", sentiment: "positive" },
        sourceUrl: "https://anthropic.com/news/claude-3-5-sonnet",
        scrapedAt: ago(28),
      },
      {
        id: "ch-1c",
        title: "Google DeepMind's Gemini 1.5 Pro Handles 1M-Token Agentic Tasks",
        content:
          "## Overview\nGemini 1.5 Pro's 1-million-token context window is reshaping how agents handle long-horizon tasks — the model can ingest an entire codebase, design doc, and test suite in a single prompt.\n\n## Key Points\n- **Context**: 1M tokens ≈ 750,000 words or ~30,000 lines of code\n- **Recall**: 99.7% accuracy retrieving facts from a 1M-token document in evals\n- **Multimodal agents**: Can analyze screenshots, diagrams, and video alongside text\n\n## Why It Matters\nLong-context eliminates the chunking heuristics that cause agents to lose thread on complex tasks, enabling truly stateful multi-day workflows.",
        metadata: { category: "AI Research", sentiment: "positive" },
        sourceUrl: "https://deepmind.google/technologies/gemini/pro",
        scrapedAt: ago(25),
      },
    ],
    createdAt: ago(35),
    updatedAt: ago(24),
  }

  // ── Book 2: SWE Internships Singapore ────────────────────────────────────────
  const book2Id = "demo-book-internships"
  const book2 = {
    id: book2Id,
    prompt: "software engineering internships Singapore 2025",
    templateId: "job-posting",
    status: "done",
    chapters: [
      {
        id: "ch-2a",
        title: "Software Engineer Intern — Grab (Singapore)",
        content:
          "## Role\nGrab's Platform Engineering team is hiring SWE interns for their May–August 2025 cohort. You'll build internal developer tooling used by 3,000+ engineers.\n\n## Requirements\n- Penultimate or final year CS/CE/EE student\n- Strong fundamentals in data structures and distributed systems\n- Experience with Go, Java, or Python\n\n## What You'll Do\n- Contribute to the internal microservices platform handling 35M daily transactions\n- Collaborate with senior engineers on reliability and observability tooling\n- Ship code to production within the first two weeks\n\n## Compensation\nSGD 2,000–3,500/month depending on year of study.",
        metadata: { company: "Grab", location: "Singapore", role: "SWE Intern" },
        sourceUrl: "https://careers.grab.com/jobs/software-engineer-intern-2025",
        scrapedAt: ago(20),
      },
      {
        id: "ch-2b",
        title: "Backend Engineering Intern — Shopee (Sea Group)",
        content:
          "## Role\nShopee's Core Infrastructure team is looking for backend engineering interns to join their Singapore HQ for summer 2025.\n\n## Requirements\n- Pursuing a degree in Computer Science or related field\n- Proficiency in at least one of: C++, Java, Golang\n- Understanding of Linux, networking, or storage systems is a plus\n\n## What You'll Do\n- Design and implement features in Shopee's order management system\n- Write unit and integration tests; participate in code reviews\n- Present your project to senior leadership at the end of the internship\n\n## Compensation\nSGD 2,500–4,000/month. Housing allowance available for non-local students.",
        metadata: { company: "Sea Group / Shopee", location: "Singapore", role: "Backend Intern" },
        sourceUrl: "https://careers.sea.com/jobs/backend-engineering-intern",
        scrapedAt: ago(18),
      },
      {
        id: "ch-2c",
        title: "Full-Stack Intern — Singtel Digital (NCS Group)",
        content:
          "## Role\nNCS Group (Singtel's tech arm) is hiring full-stack interns to work on public-sector digital transformation projects across Singapore government agencies.\n\n## Requirements\n- Undergraduate in Computer Science, Information Systems, or related\n- React + TypeScript on the frontend; Node.js or Spring Boot on the backend\n- GPA ≥ 3.5 preferred\n\n## What You'll Do\n- Build features for citizen-facing web portals\n- Work within a Scrum team using Azure DevOps\n- Shadow senior consultants on client workshops\n\n## Compensation\nSGD 1,800–2,500/month. CPF contributions provided.",
        metadata: { company: "NCS Group / Singtel", location: "Singapore", role: "Full-Stack Intern" },
        sourceUrl: "https://careers.ncs.com.sg/jobs/full-stack-intern-2025",
        scrapedAt: ago(15),
      },
    ],
    createdAt: ago(25),
    updatedAt: ago(14),
  }

  // ── Book 3: Data Privacy ─────────────────────────────────────────────────────
  const book3Id = "demo-book-data-privacy"
  const book3 = {
    id: book3Id,
    prompt: "how to opt out of data brokers and people-search sites",
    templateId: "news",
    status: "done",
    chapters: [
      {
        id: "ch-3a",
        title: "The 10 Biggest Data Brokers You Should Opt Out of Right Now",
        content:
          "## Overview\nData brokers like Spokeo, Whitepages, BeenVerified, and Intelius collectively hold records on 97% of American adults. Here's how to remove yourself from the most pervasive ones.\n\n## Top Brokers to Target\n1. **Spokeo** — opt-out at spokeo.com/opt-out-email, takes 24–72 hours\n2. **Whitepages** — submit at whitepages.com/suppression-requests, instant\n3. **BeenVerified** — optout.beenverified.com, email confirmation required\n4. **Intelius** — intelius.com/opt-out, 72-hour processing window\n5. **PeopleFinder** — peoplefinders.com/opt-out, standard form\n\n## Pro Tip\nUse a dedicated burner email when filling out opt-out forms — many brokers re-add your email to marketing lists after submission.",
        metadata: { category: "Privacy", sentiment: "informational" },
        sourceUrl: "https://www.privacyrights.org/data-broker-opt-out-guide",
        scrapedAt: ago(10),
      },
      {
        id: "ch-3b",
        title: "California's Delete Act (SB 362): What It Means for Your Data",
        content:
          "## Overview\nCalifornia's Delete Act, signed in October 2023, requires data brokers to honor deletion requests made through a single centralized portal by 2026 — a major simplification of the current opt-out maze.\n\n## Key Provisions\n- **Single portal**: Californians will be able to submit one deletion request that propagates to all 480+ registered data brokers\n- **Annual deletion**: Opt-outs must be renewed yearly (brokers can re-acquire public records)\n- **Enforcement**: $200/day fines per consumer for non-compliance\n\n## Timeline\n- 2024: CPPA (CA Privacy Protection Agency) builds the deletion portal\n- 2026: All registered brokers must honor portal requests within 45 days\n\n## Impact\nExperts estimate the portal will reduce the average time to opt out from 30+ hours to under 5 minutes for California residents.",
        metadata: { category: "Privacy Law", sentiment: "positive" },
        sourceUrl: "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240SB362",
        scrapedAt: ago(8),
      },
      {
        id: "ch-3c",
        title: "Google's 'Results About You' Tool: Hidden Gem for Data Removal",
        content:
          "## Overview\nGoogle's 'Results About You' dashboard (myactivity.google.com/results-about-you) lets you request removal of search results containing your personal information — phone number, home address, email — from Google Search index.\n\n## How It Works\n1. Go to myactivity.google.com/results-about-you\n2. Enter your name, email, phone, and address\n3. Google scans search results and flags pages containing your info\n4. Submit removal requests with one click per result\n5. Google contacts the site owner AND de-indexes the result\n\n## Limitations\n- Only removes from Google's index, not the source site\n- Doesn't cover Images or other Google products yet\n- Processing takes 1–4 weeks\n\n## Verdict\nUsed alongside direct broker opt-outs, this tool significantly reduces your search-based digital footprint.",
        metadata: { category: "Privacy Tools", sentiment: "positive" },
        sourceUrl: "https://myactivity.google.com/results-about-you",
        scrapedAt: ago(6),
      },
    ],
    createdAt: ago(15),
    updatedAt: ago(5),
  }

  // ── Write to storage ─────────────────────────────────────────────────────────
  await chrome.storage.local.set({
    "books:index": [book1Id, book2Id, book3Id],
    [`books:chapter:${book1Id}`]: book1,
    [`books:chapter:${book2Id}`]: book2,
    [`books:chapter:${book3Id}`]: book3,
  })

  console.log("✅ Demo data seeded successfully!")
  console.log("   Reload the extension popup to see 3 books in the History sidebar.")
  console.log("   Books seeded:")
  console.log(`   • ${book1.prompt}`)
  console.log(`   • ${book2.prompt}`)
  console.log(`   • ${book3.prompt}`)
})()
