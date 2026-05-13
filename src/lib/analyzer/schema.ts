import { z } from "zod";

export const SentimentSchema = z.enum(["positive", "negative", "neutral", "mixed"]);

// --- Executive summary ---

export const ExecutiveSummarySchema = z.object({
  vsConsensus: z
    .enum(["beat", "miss", "inline", "unknown"])
    .describe("Overall performance vs Wall Street consensus. Use 'unknown' if no consensus data was provided"),
  oneLineAssessment: z
    .string()
    .describe("Single sentence — the most important takeaway from this quarter"),
  highlights: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe("3-8 bullet points with concrete numbers (revenue, EPS, margins, key segment data) including YoY and QoQ context where available"),
});

// --- Financial KPIs ---

export const KpiSchema = z.object({
  label: z.string().describe("Metric name, e.g. 'Revenue', 'Gross margin', 'EPS'"),
  value: z.string().describe("Reported value with units, e.g. '$57.0B', '73.4%', '$1.30'"),
  yoy: z.string().nullable().describe("YoY change with sign, e.g. '+62%', '-5%'; null if not available"),
  qoq: z.string().nullable().describe("QoQ change with sign; null if not available"),
  vsConsensus: z
    .string()
    .nullable()
    .describe("Comparison vs consensus if data available, e.g. 'Beat by $1.5B'; null otherwise"),
});

export const MixEntrySchema = z.object({
  category: z.string().describe("e.g. 'Data Center', 'Gaming', '7nm node'"),
  value: z.string().describe("Absolute value or share, e.g. '$51.2B' or '59%'"),
  growth: z.string().nullable().describe("YoY or QoQ growth context; null if not available"),
});

export const MixBreakdownSchema = z.object({
  dimension: z
    .string()
    .describe("Breakdown dimension, e.g. 'Revenue by segment', 'Revenue by geography', 'Revenue by technology node'"),
  entries: z.array(MixEntrySchema).min(2),
});

// --- Guidance ---

export const GuidanceMetricSchema = z.object({
  metric: z.string().describe("e.g. 'Revenue', 'Gross margin'"),
  guided: z.string().describe("Guided value with range if given, e.g. '$65B ±2%'"),
  consensus: z.string().nullable().describe("Consensus estimate for the same metric if provided; null otherwise"),
  delta: z
    .string()
    .nullable()
    .describe("Comparison to consensus, e.g. '+5% above consensus'; null if no consensus"),
});

export const GuidanceSchema = z.object({
  nextPeriod: z
    .array(GuidanceMetricSchema)
    .describe("Next-period guided metrics (revenue, margins, opex, etc.)"),
  fullYearOutlook: z
    .array(z.string())
    .describe("Bullet points on the full-year or multi-year outlook; empty array if none discussed"),
  positiveFactors: z
    .array(z.string())
    .describe("Tailwinds or positive drivers management cited"),
  riskFactors: z
    .array(z.string())
    .describe("Headwinds, risks, or concerns management cited (or omitted but evident)"),
});

// --- Management remarks & Q&A ---

export const ManagementRemarkSchema = z.object({
  topic: z.string().describe("Short topic title, e.g. 'AI infrastructure demand', 'Gross margin trajectory'"),
  sentiment: SentimentSchema,
  commentary: z
    .string()
    .describe("2-4 sentences capturing management's view, key data points, and forward implication"),
  bestQuote: z
    .string()
    .nullable()
    .describe("Single most representative verbatim quote from the prepared remarks; null if no clean quote available"),
});

export const QAItemSchema = z.object({
  analystFirm: z.string().nullable().describe("Analyst firm if identifiable, e.g. 'Morgan Stanley'; null otherwise"),
  question: z.string().describe("Analyst's question, paraphrased concisely"),
  response: z.string().describe("Management's response, paraphrased to 2-3 sentences"),
  bestQuote: z
    .string()
    .nullable()
    .describe("Single most representative verbatim management quote; null if no clean quote"),
});

// --- Cross-cutting themes (used by dashboard for aggregation) ---

export const CrossCuttingThemeSchema = z.object({
  name: z
    .string()
    .describe("Industry-level theme tag, e.g. 'AI HPC demand', 'HBM tightness', 'Auto recovery', 'China weakness'. Use canonical names so the same theme can be aggregated across companies."),
  sentiment: SentimentSchema,
});

// --- Scores (used for heatmap and segment rollup) ---

export const ScoresSchema = z.object({
  revenueGrowth: z.number().min(0).max(100),
  margins: z.number().min(0).max(100),
  guidance: z.number().min(0).max(100),
  sentiment: z.number().min(0).max(100),
});

// --- Master schema ---

export const ReportSchema = z.object({
  executiveSummary: ExecutiveSummarySchema,
  scores: ScoresSchema,
  quarterlyKpis: z.array(KpiSchema),
  fullYearKpis: z.array(KpiSchema),
  revenueMix: z.array(MixBreakdownSchema),
  guidance: GuidanceSchema,
  managementRemarks: z.array(ManagementRemarkSchema),
  qaHighlights: z.array(QAItemSchema),
  crossCuttingThemes: z.array(CrossCuttingThemeSchema),
  investorTakeaways: z.array(z.string()),
  flags: z.array(z.string()),
});

export type Report = z.infer<typeof ReportSchema>;
export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;
export type Kpi = z.infer<typeof KpiSchema>;
export type MixBreakdown = z.infer<typeof MixBreakdownSchema>;
export type Guidance = z.infer<typeof GuidanceSchema>;
export type ManagementRemark = z.infer<typeof ManagementRemarkSchema>;
export type QAItem = z.infer<typeof QAItemSchema>;
export type CrossCuttingTheme = z.infer<typeof CrossCuttingThemeSchema>;
export type Scores = z.infer<typeof ScoresSchema>;
