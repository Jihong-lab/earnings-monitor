import "@/lib/env";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ReportSchema, type Report } from "./schema";

const QUICK_MODEL = "claude-haiku-4-5";
const DEEP_MODEL = "claude-opus-4-7";

// --- Stage 1: quick check (Haiku + web_search only) ---

const QuickCheckSchema = z.union([
  z.object({
    status: z.literal("no_new_earnings"),
    reason: z.string(),
  }),
  z.object({
    status: z.literal("new"),
    fiscalPeriod: z.string(),
    reportedAt: z.string(),
  }),
]);

const QUICK_SYSTEM = `You are an equity-research assistant. Your only job is to check whether a company has released a newer quarterly earnings result than the one we already have.

You will be given:
- Company name and ticker
- Last-known reported fiscal period (or "none")
- Today's date

PROCESS:
1. Use web_search (1-3 calls) to find the most recent quarterly earnings result this company has reported. Look at sources like Yahoo Finance, MarketBeat, NASDAQ, the company's IR site, or news.
2. Determine whether that most recent quarter is NEWER than the last-known period.

RESPONSE (JSON only, no fences, no prose):

If no new earnings since the last-known period (i.e. the most recent reported quarter is the same as what we have, or we already have the latest reported quarter):
{ "status": "no_new_earnings", "reason": "<one-sentence reason citing the latest reported quarter and date>" }

If newer earnings have been released:
{ "status": "new", "fiscalPeriod": "<e.g. FY2026Q4 or CY2025Q4>", "reportedAt": "<YYYY-MM-DD of when the earnings were reported>" }

Do not perform deep analysis. Just identify whether new earnings exist.`;

// --- Stage 2: deep analysis (Opus + web_search + web_fetch) ---

const DeepEnvelopeSchema = z.object({
  fiscalPeriod: z.string(),
  reportedAt: z.string(),
  sourceUrls: z.array(z.string()),
  report: ReportSchema,
});

const DEEP_SYSTEM = `You are a senior equity analyst with web research capability. A separate quick-check step has already confirmed that the company has released new quarterly earnings. Your job is to fetch the materials and produce a structured JSON report.

PROCESS:
1. Use web_fetch (up to 4 calls) to retrieve the actual content of the most useful primary sources for the specified fiscal period:
   - The company's earnings press release on their IR site
   - The earnings call transcript if available (Q&A section is highly valuable)
   - Consensus / beat-miss commentary (Yahoo Finance, MarketBeat, NASDAQ)
   - Sector-relevant analyst/research commentary if it adds material color
2. You may use web_search (up to 3 calls) to locate the right URLs before fetching.
3. Prefer canonical primary sources. Don't fetch the same page multiple times.

OUTPUT (JSON only, no fences, no prose):
{
  "fiscalPeriod": "<as given>",
  "reportedAt": "<YYYY-MM-DD>",
  "sourceUrls": ["url1","url2",...],
  "report": {
    "executiveSummary": {
      "vsConsensus": "beat" | "miss" | "inline" | "unknown",
      "oneLineAssessment": "...",
      "highlights": ["3-8 bullets with concrete numbers and YoY/QoQ context"]
    },
    "scores": { "revenueGrowth": 0-100, "margins": 0-100, "guidance": 0-100, "sentiment": 0-100 },
    "quarterlyKpis": [ { "label": "...", "value": "...", "yoy": "..." | null, "qoq": "..." | null, "vsConsensus": "..." | null } ],
    "fullYearKpis": [ { same shape } ],
    "revenueMix": [ { "dimension": "...", "entries": [ { "category": "...", "value": "...", "growth": "..." | null } ] } ],
    "guidance": {
      "nextPeriod": [ { "metric": "...", "guided": "...", "consensus": "..." | null, "delta": "..." | null } ],
      "fullYearOutlook": [ "bullets" ],
      "positiveFactors": [ "bullets" ],
      "riskFactors": [ "bullets" ]
    },
    "managementRemarks": [ { "topic": "...", "sentiment": "positive"|"negative"|"neutral"|"mixed", "commentary": "...", "bestQuote": "..." | null } ],
    "qaHighlights": [ { "analystFirm": "..." | null, "question": "...", "response": "...", "bestQuote": "..." | null } ],
    "crossCuttingThemes": [ { "name": "canonical name", "sentiment": "positive"|"negative"|"neutral"|"mixed" } ],
    "investorTakeaways": ["4-8 strategic conclusions"],
    "flags": ["risk flags or input-quality limitations"]
  }
}

RULES:
- Never fabricate. If a number, segment, or Q&A item isn't in your fetched sources, omit it.
- vsConsensus must be "unknown" if you couldn't find consensus estimates.
- Cross-cutting theme names must be terse and canonical (e.g. "AI HPC demand", "HBM tightness", "Auto recovery", "China weakness", "Capex acceleration", "Memory cycle inflection", "Datacenter buildout").
- Do NOT prefix takeaway strings with "1. " etc.
- Output ONLY the JSON.`;

// --- Common helpers ---

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

function extractJson(text: string): unknown {
  let trimmed = text.trim();
  // Strip surrounding code fence if present
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    trimmed = fence[1].trim();
  } else {
    // Strip any prose before/after a top-level JSON object
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      trimmed = trimmed.slice(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(trimmed);
}

function getFinalText(response: Anthropic.Message): string {
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  const text = textBlocks[textBlocks.length - 1]?.text;
  if (!text) {
    throw new Error(
      `No text in response. stop_reason=${response.stop_reason}${
        response.stop_reason === "refusal" && response.stop_details
          ? `, category=${response.stop_details.category}`
          : ""
      }`,
    );
  }
  return text;
}

async function continueIfPaused(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  initialResponse: Anthropic.Message,
): Promise<Anthropic.Message> {
  let response = initialResponse;
  let messages = [...params.messages];
  let safety = 0;
  while (response.stop_reason === "pause_turn" && safety < 3) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await client.messages.create({ ...params, messages });
    safety++;
  }
  return response;
}

// --- Stage 1 ---

async function quickCheck(opts: AutoAnalyzeOptions): Promise<{
  result: z.infer<typeof QuickCheckSchema>;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
}> {
  const client = getClient();
  const userMessage = `Company: ${opts.companyName} (${opts.ticker})
Last-known reported fiscal period: ${opts.lastKnownPeriod ?? "none"}
Today's date: ${new Date().toISOString().slice(0, 10)}

Check whether new earnings have been released.`;

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: QUICK_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: QUICK_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    messages: [{ role: "user", content: userMessage }],
  };

  let response = await client.messages.create(params);
  response = await continueIfPaused(client, params, response);

  const text = getFinalText(response);
  const parsed = extractJson(text);
  const validation = QuickCheckSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `Quick check returned invalid envelope: ${validation.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}. Raw: ${text.slice(0, 300)}`,
    );
  }
  const toolCalls = response.content.filter((b) => b.type === "server_tool_use").length;
  return {
    result: validation.data,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    toolCalls,
  };
}

// --- Stage 2 ---

async function deepAnalyze(
  opts: AutoAnalyzeOptions,
  fiscalPeriod: string,
  reportedAt: string,
): Promise<{
  result: z.infer<typeof DeepEnvelopeSchema>;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  model: string;
}> {
  const client = getClient();
  const userMessage = `Company: ${opts.companyName} (${opts.ticker})
Fiscal period to analyze: ${fiscalPeriod}
Reported date: ${reportedAt}

Fetch the materials and produce the full JSON report.`;

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: DEEP_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: DEEP_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: 3 },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: 4 },
    ],
    messages: [{ role: "user", content: userMessage }],
  };

  let response = await client.messages.create(params);
  response = await continueIfPaused(client, params, response);

  const text = getFinalText(response);
  const parsed = extractJson(text);
  const validation = DeepEnvelopeSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `Deep analysis returned invalid envelope: ${validation.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  const toolCalls = response.content.filter((b) => b.type === "server_tool_use").length;
  return {
    result: validation.data,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    toolCalls,
    model: response.model,
  };
}

// --- Public entry point ---

export type AutoResult =
  | { status: "no_new_earnings"; reason: string }
  | {
      status: "new";
      fiscalPeriod: string;
      reportedAt: string;
      sourceUrls: string[];
      report: Report;
    };

export interface AutoAnalyzeOptions {
  companyName: string;
  ticker: string;
  lastKnownPeriod: string | null;
}

export interface AutoAnalyzeMeta {
  model: string;
  quickInputTokens: number;
  quickOutputTokens: number;
  quickToolCalls: number;
  deepInputTokens: number;
  deepOutputTokens: number;
  deepToolCalls: number;
}

export async function autoAnalyzeFromWeb(
  opts: AutoAnalyzeOptions,
): Promise<{ result: AutoResult; meta: AutoAnalyzeMeta }> {
  const quick = await quickCheck(opts);

  // Default meta
  const meta: AutoAnalyzeMeta = {
    model: `${QUICK_MODEL} (quick)`,
    quickInputTokens: quick.inputTokens,
    quickOutputTokens: quick.outputTokens,
    quickToolCalls: quick.toolCalls,
    deepInputTokens: 0,
    deepOutputTokens: 0,
    deepToolCalls: 0,
  };

  if (quick.result.status === "no_new_earnings") {
    return { result: { status: "no_new_earnings", reason: quick.result.reason }, meta };
  }

  // Sanity: if the period returned matches what we already have, treat as no-new
  if (quick.result.fiscalPeriod === opts.lastKnownPeriod) {
    return {
      result: {
        status: "no_new_earnings",
        reason: `Quick check returned the already-known period ${quick.result.fiscalPeriod}`,
      },
      meta,
    };
  }

  const deep = await deepAnalyze(
    opts,
    quick.result.fiscalPeriod,
    quick.result.reportedAt,
  );

  return {
    result: {
      status: "new",
      fiscalPeriod: deep.result.fiscalPeriod,
      reportedAt: deep.result.reportedAt,
      sourceUrls: deep.result.sourceUrls,
      report: deep.result.report,
    },
    meta: {
      ...meta,
      model: `${QUICK_MODEL} + ${deep.model}`,
      deepInputTokens: deep.inputTokens,
      deepOutputTokens: deep.outputTokens,
      deepToolCalls: deep.toolCalls,
    },
  };
}
