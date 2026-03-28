import type { FeedTemplate } from "./types"

const marketData: FeedTemplate = {
  id: "market-data",
  name: "Market Data & Prices",

  triggerKeywords: [
    "stock price",
    "stock market",
    "market index",
    "market indices",
    "s&p 500",
    "nasdaq",
    "dow jones",
    "bitcoin price",
    "crypto price",
    "trading volume",
    "market cap",
    "commodity price",
    "forex rate",
    "exchange rate",
    "ticker",
    "market close",
    "market open",
    "bull market",
    "bear market",
    "etf price"
  ],

  tinyfishGoal: `Extract the following market data fields from this page and return as JSON:
{
  "assetName": "full name of the asset, stock, or instrument",
  "ticker": "ticker symbol (e.g. AAPL, BTC-USD), or null",
  "assetType": "Stock / Crypto / Commodity / Forex / ETF / Index",
  "price": "current or latest price as a string (e.g. '182.52')",
  "currency": "currency code (e.g. USD, EUR), or null",
  "change": "price change value as a string (e.g. '+3.21' or '-1.05'), or null",
  "changePercent": "percentage change as a string (e.g. '+1.79%'), or null",
  "volume": "trading volume as a string, or null",
  "marketCap": "market capitalization as a string, or null",
  "high52w": "52-week high price, or null",
  "low52w": "52-week low price, or null",
  "timestamp": "data timestamp or 'as of' date/time, or null",
  "additionalData": "any other relevant data points as a string, or null",
  "source": "data source or publication name",
  "body": "full article text surrounding the data, preserving all analyst commentary and context"
}
Extract verbatim. Do not summarize the body.`,

  parseSystemPrompt: `You receive raw extracted market data as JSON. Format it into a structured Chapter.

Return ONLY valid JSON:
{
  "title": "<assetName> (<ticker>) — <price> <currency>",
  "content": "<formatted markdown>",
  "metadata": {
    "assetName": "<name>",
    "ticker": "<ticker or null>",
    "assetType": "<type>",
    "price": "<price>",
    "currency": "<currency or null>",
    "change": "<change or null>",
    "changePercent": "<percent or null>",
    "volume": "<volume or null>",
    "marketCap": "<market cap or null>",
    "timestamp": "<timestamp or null>",
    "source": "<source or null>"
  }
}

For content, use this exact structure:
**Asset:** [assetName] ([ticker]) | **Type:** [assetType]
**Price:** [price] [currency] | **Change:** [change] ([changePercent])
**Volume:** [volume] | **Market Cap:** [marketCap]
**52W Range:** [low52w] – [high52w] | **As of:** [timestamp] | **Source:** [source]

---

[body — full article text verbatim, including any analyst commentary, market context, or reporting around the data]

Rules:
- Keep all numerical values exact as extracted
- If a field is null, omit it from the header line but include null in metadata
- Do not add your own market analysis or predictions`
}

export default marketData
