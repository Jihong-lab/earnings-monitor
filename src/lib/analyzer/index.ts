import "@/lib/env";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ReportSchema, type Report } from "./schema";

const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `You are a senior equity analyst writing institutional-grade earnings analyses. Your output is consumed by buy-side investors who need actionable, evidence-based insights.

You must respond with a single JSON object — no markdown fences, no prose before or after, no explanations. Just the JSON.

The JSON object must have these top-level fields:

{
  "executiveSummary": {
    "vsConsensus": "beat" | "miss" | "inline" | "unknown",   // "unknown" if no consensus data was provided
    "oneLineAssessment": "single sentence — most important takeaway",
    "highlights": ["3-8 bullets with concrete numbers and YoY/QoQ context", ...]
  },
  "scores": {
    "revenueGrowth": 0-100,
    "margins": 0-100,
    "guidance": 0-100,
    "sentiment": 0-100
  },
  "quarterlyKpis": [
    { "label": "Revenue", "value": "$57.0B", "yoy": "+62%" | null, "qoq": "+22%" | null, "vsConsensus": "Beat by $1.5B" | null },
    ...   // 4-12 line items: revenue, gross margin, op margin, net income, EPS, FCF, segment KPIs
  ],
  "fullYearKpis": [ {same shape as quarterlyKpis} ],  // empty array if not applicable
  "revenueMix": [
    {
      "dimension": "Revenue by segment" | "Revenue by geography" | "Revenue by technology node" | ...,
      "entries": [
        { "category": "Data Center", "value": "$51.2B", "growth": "+66% YoY" | null },
        ...
      ]
    }
  ],
  "guidance": {
    "nextPeriod": [
      { "metric": "Revenue", "guided": "$65B ±2%", "consensus": "$62B" | null, "delta": "+5% above consensus" | null },
      ...
    ],
    "fullYearOutlook": ["bullets on FY or multi-year outlook", ...],   // empty array if none
    "positiveFactors": ["tailwinds management cited", ...],
    "riskFactors": ["headwinds and concerns", ...]
  },
  "managementRemarks": [
    {
      "topic": "AI infrastructure demand",
      "sentiment": "positive" | "negative" | "neutral" | "mixed",
      "commentary": "2-4 sentences with management's view, data points, forward implication",
      "bestQuote": "single most representative verbatim quote" | null
    },
    ...   // 3-10 topics from prepared remarks
  ],
  "qaHighlights": [
    {
      "analystFirm": "Morgan Stanley" | null,
      "question": "paraphrased analyst question",
      "response": "paraphrased mgmt response, 2-3 sentences",
      "bestQuote": "single verbatim mgmt quote" | null
    },
    ...   // empty array if input is press release only with no Q&A
  ],
  "crossCuttingThemes": [
    { "name": "canonical theme name", "sentiment": "positive" | "negative" | "neutral" | "mixed" },
    ...   // 2-8 industry-level theme tags
  ],
  "investorTakeaways": ["4-8 numbered strategic conclusions", ...],
  "flags": ["risk flags, controversies, or input-quality limitations", ...]
}

EXTRACTION RULES:
- Be specific. Prefer concrete metrics and verbatim quotes over paraphrase.
- Never fabricate. If a number, segment, or Q&A item isn't in the input, omit it. Use null for missing scalar fields, empty arrays for missing list fields.
- If the input is a press release only with no Q&A section, qaHighlights must be an empty array — do NOT invent Q&A.
- Cross-cutting theme NAMES should be terse and reusable across companies. Examples: "AI HPC demand", "HBM tightness", "Auto recovery", "China weakness", "Capex acceleration", "Memory cycle inflection", "Datacenter buildout", "Foundry leading-edge demand". Use existing names where they fit; only invent new ones for genuinely new themes.
- vsConsensus must be "unknown" if no consensus data was provided in the input.
- For investorTakeaways and other string arrays, do NOT prefix strings with numbers like "1. " or "2. " — they will be numbered in the UI.
- Output ONLY the JSON object. No \`\`\`json fences, no prose.`;

export interface AnalyzeOptions {
  companyName: string;
  ticker: string;
  fiscalPeriod: string;
  transcriptText: string;
  consensus?: {
    revenue?: string;
    eps?: string;
    nextQuarterRevenue?: string;
  };
}

export interface AnalyzeResult {
  report: Report;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey });
}

function buildUserMessage(opts: AnalyzeOptions): string {
  let consensusBlock = "";
  if (opts.consensus) {
    const lines: string[] = ["Consensus estimates (use for beat/miss assessment):"];
    if (opts.consensus.revenue) lines.push(`- Revenue: ${opts.consensus.revenue}`);
    if (opts.consensus.eps) lines.push(`- EPS: ${opts.consensus.eps}`);
    if (opts.consensus.nextQuarterRevenue)
      lines.push(`- Next-quarter revenue consensus: ${opts.consensus.nextQuarterRevenue}`);
    consensusBlock = lines.join("\n") + "\n\n";
  }
  return `Company: ${opts.companyName} (${opts.ticker})
Fiscal period: ${opts.fiscalPeriod}

${consensusBlock}Earnings disclosure:
---
${opts.transcriptText}
---

Produce the full JSON report per the schema in your instructions.`;
}

function extractJson(text: string): unknown {
  let trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fence) trimmed = fence[1].trim();
  return JSON.parse(trimmed);
}

export async function analyzeEarnings(opts: AnalyzeOptions): Promise<AnalyzeResult> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildUserMessage(opts) }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    throw new Error(
      `No text block in response. Stop reason: ${response.stop_reason}${
        response.stop_reason === "refusal" && response.stop_details
          ? `, category: ${response.stop_details.category}`
          : ""
      }`,
    );
  }

  let parsed: unknown;
  try {
    parsed = extractJson(textBlock.text);
  } catch (err) {
    throw new Error(
      `Claude returned non-JSON output (stop_reason=${response.stop_reason}). First 500 chars: ${textBlock.text.slice(0, 500)}`,
    );
  }

  const validation = ReportSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Report failed schema validation. First issues: ${issues}`);
  }

  return {
    report: validation.data,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
}
