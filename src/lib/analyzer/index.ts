import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AnalysisOutputSchema, type AnalysisOutput } from "./schema";

const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `You are a senior equity analyst writing concise, evidence-based summaries of company earnings reports for institutional buy-side use.

For each earnings transcript or press release you analyze:

1. Identify 3-7 major themes the management team discussed. For each theme:
   - Use a short, specific title (e.g. "Datacenter GPU demand acceleration", not "AI is growing")
   - Capture management's sentiment on it: positive, negative, neutral, or mixed
   - Write 1-2 sentences explaining the theme and why it matters for the investment thesis
   - Include up to 3 verbatim quotes from the transcript supporting the theme

2. Assign 0-100 scores on four dimensions:
   - revenueGrowth: top-line health and trajectory (acceleration vs deceleration)
   - margins: gross/operating margin trends and profitability quality
   - guidance: forward outlook strength and credibility of guidance
   - sentiment: overall management confidence and tone

3. Write a single paragraph (3-5 sentences) summarizing the quarter.

4. Note any risk flags, controversies, or material concerns under flags (empty array if none).

Be specific. Avoid generic financial-speak. Prefer concrete metrics, numbers, and verbatim quotes over paraphrase. If the input is ambiguous or thin (e.g. press release only, not transcript), note that limitation in flags.`;

export interface AnalyzeOptions {
  companyName: string;
  ticker: string;
  fiscalPeriod: string;
  transcriptText: string;
}

export interface AnalyzeResult {
  analysis: AnalysisOutput;
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

export async function analyzeEarnings(opts: AnalyzeOptions): Promise<AnalyzeResult> {
  const client = getClient();

  const userMessage = `Company: ${opts.companyName} (${opts.ticker})
Fiscal period: ${opts.fiscalPeriod}

Transcript / release:
---
${opts.transcriptText}
---

Analyze this earnings disclosure following the system instructions.`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
    output_config: {
      format: zodOutputFormat(AnalysisOutputSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error(
      `Analysis parsing failed. Stop reason: ${response.stop_reason}.${
        response.stop_reason === "refusal" && response.stop_details
          ? ` Category: ${response.stop_details.category}.`
          : ""
      }`,
    );
  }

  return {
    analysis: response.parsed_output,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
}
