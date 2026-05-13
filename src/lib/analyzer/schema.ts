import { z } from "zod";

export const SentimentSchema = z.enum(["positive", "negative", "neutral", "mixed"]);

export const ThemeSchema = z.object({
  name: z.string().describe("Short title for the theme, e.g. 'AI infrastructure demand'"),
  sentiment: SentimentSchema.describe("Management's tone on this theme"),
  description: z.string().describe("1-2 sentences explaining the theme and why it matters"),
  quotes: z
    .array(z.string())
    .describe("Up to 3 verbatim quotes from the transcript supporting this theme"),
});

export const ScoresSchema = z.object({
  revenueGrowth: z.number().min(0).max(100).describe("0-100 score on revenue growth health and trajectory"),
  margins: z.number().min(0).max(100).describe("0-100 score on profitability and margin trends"),
  guidance: z.number().min(0).max(100).describe("0-100 score on forward guidance strength"),
  sentiment: z.number().min(0).max(100).describe("0-100 score on overall management sentiment and confidence"),
});

export const AnalysisOutputSchema = z.object({
  summary: z
    .string()
    .describe("One paragraph (3-5 sentences) summarizing the quarter's key takeaways"),
  themes: z
    .array(ThemeSchema)
    .min(3)
    .max(7)
    .describe("3-7 major themes from the earnings discussion"),
  scores: ScoresSchema,
  flags: z
    .array(z.string())
    .describe("Notable risk flags or controversies (empty if none)"),
});

export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Scores = z.infer<typeof ScoresSchema>;
