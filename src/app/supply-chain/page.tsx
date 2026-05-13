import Link from "next/link";
import { companies, getCompanyBySlug } from "@/data/companies";
import { segments } from "@/data/segments";
import { db } from "@/lib/db";
import { earningsEvents, analyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { SegmentId } from "@/data/types";
import type { Report } from "@/lib/analyzer/schema";

export const dynamic = "force-dynamic";

interface Row {
  companySlug: string;
  fiscalPeriod: string;
  reportedAt: Date;
  eventId: number;
  report: Report;
}

function calendarQuarter(d: Date): string {
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `CY${y}Q${q}`;
}

function reportAvgScore(r: Report): number {
  const s = r.scores;
  return (s.revenueGrowth + s.margins + s.guidance + s.sentiment) / 4;
}

function scoreDot(score: number | null): string {
  if (score === null) return "bg-gray-300";
  if (score >= 70) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

function heatBg(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-400";
  if (score >= 75) return "bg-green-600 text-white";
  if (score >= 60) return "bg-green-400 text-white";
  if (score >= 45) return "bg-yellow-300 text-gray-900";
  if (score >= 30) return "bg-orange-400 text-white";
  return "bg-red-500 text-white";
}

const VERDICT_BADGE: Record<string, string> = {
  beat: "bg-green-100 text-green-800",
  miss: "bg-red-100 text-red-800",
  inline: "bg-gray-100 text-gray-700",
  unknown: "bg-gray-100 text-gray-500",
};

const VERDICT_LABEL: Record<string, string> = {
  beat: "Beat",
  miss: "Miss",
  inline: "Inline",
  unknown: "—",
};

export default async function SupplyChainPage() {
  const rows = await db
    .select({
      companySlug: earningsEvents.companySlug,
      fiscalPeriod: earningsEvents.fiscalPeriod,
      reportedAt: earningsEvents.reportedAt,
      eventId: earningsEvents.id,
      report: analyses.report,
    })
    .from(analyses)
    .innerJoin(earningsEvents, eq(analyses.eventId, earningsEvents.id))
    .orderBy(desc(earningsEvents.reportedAt));
  const allRows: Row[] = rows.map((r) => ({ ...r, report: r.report as Report }));

  const latestByCompany = new Map<string, Row>();
  for (const r of allRows) {
    if (!latestByCompany.has(r.companySlug)) latestByCompany.set(r.companySlug, r);
  }

  // Most recent calendar quarter across the dataset
  const allCQ = new Set<string>();
  for (const r of allRows) allCQ.add(calendarQuarter(new Date(r.reportedAt)));
  const sortedQuarters = Array.from(allCQ).sort();
  const latestPeriodLabel = sortedQuarters[sortedQuarters.length - 1] ?? "—";

  // Scorecard rows (latest reports per segment)
  type SegmentScore = {
    segmentId: SegmentId;
    segmentName: string;
    score: number | null;
    rows: Array<{
      eventId: number;
      ticker: string;
      flag: string;
      verdict: string;
      revYoy: string | null;
    }>;
  };
  const scoreCards: SegmentScore[] = segments.map((seg) => {
    const segCompanies = companies.filter((c) => c.segmentId === seg.id);
    const latestRows = segCompanies
      .map((c) => latestByCompany.get(c.slug))
      .filter((r): r is Row => Boolean(r));
    const score =
      latestRows.length > 0
        ? Math.round(
            (latestRows.reduce((s, r) => s + reportAvgScore(r.report), 0) /
              latestRows.length) *
              10,
          ) / 10
        : null;
    const rows = latestRows.map((r) => {
      const c = getCompanyBySlug(r.companySlug)!;
      const revKpi = r.report.quarterlyKpis.find(
        (k) =>
          k.label.toLowerCase().includes("revenue") &&
          !k.label.toLowerCase().includes("growth"),
      );
      return {
        eventId: r.eventId,
        ticker: c.ticker,
        flag: c.exchange,
        verdict: r.report.executiveSummary.vsConsensus,
        revYoy: revKpi?.yoy ?? null,
      };
    });
    return { segmentId: seg.id, segmentName: seg.name, score, rows };
  });

  // Heatmap cells
  const cellScores = new Map<string, { sum: number; count: number }>();
  for (const r of allRows) {
    const c = getCompanyBySlug(r.companySlug);
    if (!c) continue;
    const cq = calendarQuarter(new Date(r.reportedAt));
    const key = `${c.segmentId}|${cq}`;
    const cell = cellScores.get(key) ?? { sum: 0, count: 0 };
    cell.sum += reportAvgScore(r.report);
    cell.count += 1;
    cellScores.set(key, cell);
  }

  // Top themes
  const themeAgg = new Map<
    string,
    { count: number; sentimentMix: Record<string, number>; companies: Set<string> }
  >();
  for (const r of allRows) {
    for (const t of r.report.crossCuttingThemes) {
      const agg = themeAgg.get(t.name) ?? {
        count: 0,
        sentimentMix: {},
        companies: new Set<string>(),
      };
      agg.count += 1;
      agg.sentimentMix[t.sentiment] = (agg.sentimentMix[t.sentiment] ?? 0) + 1;
      agg.companies.add(r.companySlug);
      themeAgg.set(t.name, agg);
    }
  }
  const topThemes = Array.from(themeAgg.entries())
    .sort((a, b) => b[1].companies.size - a[1].companies.size)
    .slice(0, 12);

  const lastUpdated = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Supply Chain Health</h2>
          <p className="text-xs text-gray-500 mt-0.5">Updated: {lastUpdated}</p>
        </div>
        <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded text-xs font-semibold">
          {latestPeriodLabel}
        </span>
      </div>

      {/* Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scoreCards.map((s) => (
          <div
            key={s.segmentId}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${scoreDot(s.score)}`}></span>
                <h3 className="font-semibold text-sm text-gray-900">{s.segmentName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl font-bold font-mono ${scoreColor(s.score)}`}
                >
                  {s.score ?? "—"}
                </span>
              </div>
            </div>
            {s.rows.length === 0 ? (
              <p className="text-xs text-gray-400">No company data.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-100">
                      <th className="text-left py-1 pr-2 font-medium">Ticker</th>
                      <th className="text-left py-1 px-2 font-medium">Verdict</th>
                      <th className="text-right py-1 pl-2 font-medium">Rev YoY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r) => (
                      <tr key={r.eventId} className="border-b border-gray-50">
                        <td className="py-1.5 pr-2">
                          <Link
                            href={`/earnings/${r.eventId}`}
                            className="font-semibold text-gray-900 hover:text-blue-600"
                          >
                            {r.ticker}
                          </Link>
                        </td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded font-semibold ${VERDICT_BADGE[r.verdict]}`}
                          >
                            {VERDICT_LABEL[r.verdict]}
                          </span>
                        </td>
                        <td className="py-1.5 pl-2 text-right font-mono text-gray-700">
                          {r.revYoy ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <section>
        <h2 className="text-sm font-bold text-gray-900 mb-3">Quarterly Heatmap</h2>
        {sortedQuarters.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-500">
            Will populate as more quarters are analyzed.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 pr-3 font-medium">Segment</th>
                  {sortedQuarters.map((q) => (
                    <th key={q} className="text-center py-2 px-2 font-medium font-mono">
                      {q}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {segments.map((seg) => (
                  <tr key={seg.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-700">{seg.name}</td>
                    {sortedQuarters.map((q) => {
                      const cell = cellScores.get(`${seg.id}|${q}`);
                      const score = cell ? cell.sum / cell.count : null;
                      const rounded = score === null ? null : Math.round(score * 10) / 10;
                      return (
                        <td key={q} className="py-2 px-2 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded font-mono tabular-nums ${heatBg(score)}`}
                          >
                            {rounded ?? "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Themes */}
      <section>
        <h2 className="text-sm font-bold text-gray-900 mb-3">Top Cross-Cutting Themes</h2>
        {topThemes.length === 0 ? (
          <p className="text-sm text-gray-500">No themes yet.</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {topThemes.map(([name, agg]) => {
              const dominantSentiment = Object.entries(agg.sentimentMix).sort(
                (a, b) => b[1] - a[1],
              )[0]?.[0];
              return (
                <div key={name} className="flex items-center justify-between px-4 py-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {agg.companies.size} compan
                      {agg.companies.size === 1 ? "y" : "ies"} · mostly{" "}
                      {dominantSentiment}
                    </div>
                  </div>
                  <div className="flex gap-1 text-xs font-mono">
                    {(["positive", "mixed", "neutral", "negative"] as const).map(
                      (s) =>
                        (agg.sentimentMix[s] ?? 0) > 0 && (
                          <span
                            key={s}
                            className={`px-1.5 py-0.5 rounded ${
                              s === "positive"
                                ? "bg-green-100 text-green-800"
                                : s === "negative"
                                  ? "bg-red-100 text-red-800"
                                  : s === "mixed"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {s[0].toUpperCase()}
                            {agg.sentimentMix[s]}
                          </span>
                        ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
