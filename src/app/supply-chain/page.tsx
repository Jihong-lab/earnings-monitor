import { companies } from "@/data/companies";
import { segments } from "@/data/segments";
import { db } from "@/lib/db";
import { earningsEvents, analyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { SegmentId } from "@/data/types";
import type { Report } from "@/lib/analyzer/schema";

export const dynamic = "force-dynamic";

interface SegmentScore {
  segmentId: SegmentId;
  segmentName: string;
  score: number | null;
  latest?: { companySlug: string; ticker: string; period: string; vsConsensus: string };
}

async function getSegmentScores(): Promise<SegmentScore[]> {
  // Most-recent analysis per company, then average scores by segment
  const rows = await db
    .select({
      companySlug: earningsEvents.companySlug,
      fiscalPeriod: earningsEvents.fiscalPeriod,
      reportedAt: earningsEvents.reportedAt,
      report: analyses.report,
    })
    .from(analyses)
    .innerJoin(earningsEvents, eq(analyses.eventId, earningsEvents.id))
    .orderBy(desc(earningsEvents.reportedAt));

  // Keep only latest per company
  const latestPerCompany = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestPerCompany.has(row.companySlug)) {
      latestPerCompany.set(row.companySlug, row);
    }
  }

  const results: SegmentScore[] = [];
  for (const seg of segments) {
    const segCompanies = companies.filter((c) => c.segmentId === seg.id);
    const latestRows = segCompanies
      .map((c) => latestPerCompany.get(c.slug))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));

    if (latestRows.length === 0) {
      results.push({ segmentId: seg.id, segmentName: seg.name, score: null });
      continue;
    }

    const avg =
      latestRows.reduce((sum, r) => {
        const rep = r.report as Report;
        const s = rep.scores;
        return sum + (s.revenueGrowth + s.margins + s.guidance + s.sentiment) / 4;
      }, 0) / latestRows.length;

    const firstRow = latestRows[0];
    const firstCompany = companies.find((c) => c.slug === firstRow.companySlug);
    const firstReport = firstRow.report as Report;
    results.push({
      segmentId: seg.id,
      segmentName: seg.name,
      score: Math.round(avg * 10) / 10,
      latest: {
        companySlug: firstRow.companySlug,
        ticker: firstCompany?.ticker ?? firstRow.companySlug,
        period: firstRow.fiscalPeriod,
        vsConsensus: firstReport.executiveSummary.vsConsensus,
      },
    });
  }
  return results;
}

export default async function SupplyChainPage() {
  const segScores = await getSegmentScores();
  const lastUpdated = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Supply Chain Health</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Quarterly scorecard · updated {lastUpdated}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
        {segScores.map((s) => (
          <div
            key={s.segmentId}
            className="border border-zinc-200 dark:border-zinc-800 rounded-md p-4"
          >
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
              {s.segmentName}
            </div>
            <div className="text-3xl font-mono tabular-nums mb-2">
              {s.score ?? <span className="text-zinc-400">—</span>}
            </div>
            {s.latest ? (
              <div className="text-xs text-zinc-500 font-mono">
                {s.latest.ticker} · {s.latest.period} · {s.latest.vsConsensus}
              </div>
            ) : (
              <div className="text-xs text-zinc-500">No company data</div>
            )}
          </div>
        ))}
      </div>

      <div className="mb-10">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
          Quarterly Heatmap
        </h2>
        <p className="text-sm text-zinc-500">
          Coming soon — needs at least one full quarter of data across segments.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
          Signal Chains
        </h2>
        <p className="text-sm text-zinc-500">
          Coming soon — supply-chain flows specific to your universe (US tech ↔ Asia tech ↔
          Asia financials).
        </p>
      </div>
    </div>
  );
}
