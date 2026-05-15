import "@/lib/env";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ReportSchema, type Report } from "./schema";

const QUICK_MODEL = "claude-haiku-4-5";
const DEEP_MODEL = "claude-opus-4-7";

// --- Stage 1: quick check (Haiku + web_search only) ---

const QuickCheckSchema = z.object({
  latestFiscalPeriod: z.string().describe("e.g. FY2026Q4, CY2025Q4, or null if not found"),
  latestReportedAt: z.string().describe("YYYY-MM-DD"),
  notes: z.string().nullable().optional(),
});

const QUICK_SYSTEM = `You are an equity-research assistant. Your only job is to identify the MOST RECENT quarterly earnings result a company has reported.

You will be given:
- Company name and ticker
- Today's date

PROCESS:
1. Use web_search (1-3 calls) to find the most recent quarterly earnings result this company has reported. Look at sources like Yahoo Finance, MarketBeat, NASDAQ, the company's IR site, or news. For non-US listings, also try the company's local-market disclosures (e.g. TDnet for Japan, HKEX for HK, KIND for Korea, BSE/NSE for India, ASX for Australia).
2. Return that quarter's info. Do NOT compare against any prior knowledge — just return what you find.

RESPONSE (JSON only, no fences, no prose):

{
  "latestFiscalPeriod": "<e.g. FY2026Q4 or CY2025Q4>",
  "latestReportedAt": "<YYYY-MM-DD of when the earnings were reported>",
  "notes": "<optional brief note, or null>"
}

Do not perform deep analysis. Just identify the most recent reported quarter.`;

// --- Stage 2: deep analysis (Opus + web_search + web_fetch) ---

const DeepFullSchema = z.object({
  fiscalPeriod: z.string(),
  reportedAt: z.string(),
  sourceUrls: z.array(z.string()),
  report: ReportSchema,
});

const DeepAbortSchema = z.object({
  status: z.literal("no_new_earnings"),
  reason: z.string(),
});

const DeepEnvelopeSchema = z.union([DeepFullSchema, DeepAbortSchema]);

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
- For fields with no available data, use null for scalar fields or [] for arrays. Do not omit the field.

If after fetching you determine no new earnings actually exist (e.g. the quick check was wrong, or you cannot find the period at all), return the abort envelope instead:
{ "status": "no_new_earnings", "reason": "<short explanation of what you found instead>" }

Output ONLY the JSON object.`;

// --- Common helpers ---

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // 1) Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch {}
  // 2) Try fence-stripped
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {}
  }
  // 3) Try brace-counted extraction (handles prose before/after)
  const objStr = extractFirstJsonObject(trimmed);
  if (objStr) {
    return JSON.parse(objStr);
  }
  throw new SyntaxError("Could not locate JSON object in response");
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
Today's date: ${new Date().toISOString().slice(0, 10)}

Find the most recent reported quarter.`;

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

type DeepResult = z.infer<typeof DeepEnvelopeSchema>;

async function deepAnalyze(
  opts: AutoAnalyzeOptions,
  fiscalPeriod: string,
  reportedAt: string,
): Promise<{
  result: DeepResult;
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
      { type: "web_search_20260209", name: "web_search", max_uses: 2 },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
    ],
    messages: [{ role: "user", content: userMessage }],
  };

  let response = await client.messages.create(params);
  response = await continueIfPaused(client, params, response);

  const text = getFinalText(response);
  const parsed = extractJson(text);
  const validation = DeepEnvelopeSchema.safeParse(parsed);
  if (!validation.success) {
    const topKeys = parsed && typeof parsed === "object"
      ? Object.keys(parsed as object).join(", ")
      : typeof parsed;
    const rawPreview = JSON.stringify(parsed).slice(0, 400);
    throw new Error(
      `Deep analysis returned invalid envelope. Top-level keys: [${topKeys}]. Issues: ${validation.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join("; ")}. Raw (first 400 chars): ${rawPreview}`,
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

  // Compare what we found to what we already have
  if (quick.result.latestFiscalPeriod === opts.lastKnownPeriod) {
    return {
      result: {
        status: "no_new_earnings",
        reason: `Most recent reported quarter is ${quick.result.latestFiscalPeriod} (matches last-known)`,
      },
      meta,
    };
  }

  const deep = await deepAnalyze(
    opts,
    quick.result.latestFiscalPeriod,
    quick.result.latestReportedAt,
  );

  const fullMeta: AutoAnalyzeMeta = {
    ...meta,
    model: `${QUICK_MODEL} + ${deep.model}`,
    deepInputTokens: deep.inputTokens,
    deepOutputTokens: deep.outputTokens,
    deepToolCalls: deep.toolCalls,
  };

  // Deep stage may abort if it can't actually find the period after fetching
  if ("status" in deep.result) {
    return {
      result: { status: "no_new_earnings", reason: `Deep stage aborted: ${deep.result.reason}` },
      meta: fullMeta,
    };
  }

  return {
    result: {
      status: "new",
      fiscalPeriod: deep.result.fiscalPeriod,
      reportedAt: deep.result.reportedAt,
      sourceUrls: deep.result.sourceUrls,
      report: deep.result.report,
    },
    meta: fullMeta,
  };
}
