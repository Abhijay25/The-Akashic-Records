import type { FeedTemplate } from "./types"

const financialAnalysis: FeedTemplate = {
  id: "financial-analysis",
  name: "Financial Analysis & Forecasts",

  triggerKeywords: [
    "analyst prediction",
    "analyst forecast",
    "earnings estimate",
    "earnings report",
    "price target",
    "buy rating",
    "sell rating",
    "hold rating",
    "macro outlook",
    "financial forecast",
    "revenue estimate",
    "gdp forecast",
    "inflation forecast",
    "interest rate outlook",
    "quarterly earnings",
    "wall street consensus",
    "investment thesis",
    "sector outlook",
    "economic indicator"
  ],

  tinyfishGoal: `Extract the following financial analysis fields from this page and return as JSON:
{
  "headline": "article or report headline",
  "analyst": "analyst name, or null",
  "firm": "firm or institution name, or null",
  "subject": "company, sector, or economy being analyzed",
  "analysisType": "type of analysis (e.g. Earnings Report, Price Target, Macro Outlook, Sector Analysis)",
  "rating": "analyst rating (Buy / Sell / Hold / Overweight / Underweight), or null",
  "priceTarget": "price target as a string (e.g. '$250'), or null",
  "timeHorizon": "time horizon for the analysis (e.g. Q1 2025, 12-month, FY2025), or null",
  "keyFindings": "key data points or conclusions as a string, or null",
  "body": "complete analysis text preserving all data points, projections, and reasoning",
  "publishedDate": "publication date, or null",
  "source": "publication or outlet name"
}
Extract verbatim. Do not summarize the body.`,

  parseSystemPrompt: `You receive raw extracted financial analysis data as JSON. Format it into a structured Chapter.

Return ONLY valid JSON:
{
  "title": "<headline>",
  "content": "<formatted markdown>",
  "metadata": {
    "analyst": "<analyst or null>",
    "firm": "<firm or null>",
    "subject": "<subject>",
    "analysisType": "<type or null>",
    "rating": "<rating or null>",
    "priceTarget": "<target or null>",
    "timeHorizon": "<horizon or null>",
    "publishedDate": "<date or null>",
    "source": "<source or null>"
  }
}

For content, use this exact structure:
**Analyst:** [analyst] ([firm]) | **Published:** [publishedDate]
**Subject:** [subject] | **Type:** [analysisType]
**Rating:** [rating] | **Price Target:** [priceTarget] | **Horizon:** [timeHorizon]

---

[body — full analysis text verbatim, preserving all data points, projections, and reasoning]

Rules:
- Keep all numerical values, percentages, and projections exact
- Do not add your own financial analysis or opinions
- If a field is null, omit it from the header line but include null in metadata`
}

export default financialAnalysis
