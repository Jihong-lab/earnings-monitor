import { companies, getCompanyBySlug } from "@/data/companies";
import { segments } from "@/data/segments";
import { db } from "@/lib/db";
import { earningsEvents, analyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { SegmentId } from "@/data/types";
import type { Report } from "@/lib/analyzer/schema";
import { flagForExchange } from "@/lib/helpers";
import Link from "next/link";

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

function avg(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function reportAvgScore(r: Report): number {
  const s = r.scores;
  return (s.revenueGrowth + s.margins + s.guidance + s.sentiment) / 4;
}

function heatColor(score: number | null): string {
  if (score === null) return "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600";
  if (score >= 75) return "bg-emerald-700 text-white";
  if (score >= 60) return "bg-emerald-500 text-white";
  if (score >= 45) return "bg-amber-400 text-zinc-900";
  if (score >= 30) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
}

async function getAllRows(): Promise<Row[]> {
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
  return rows.map((r) => ({ ...r, report: r.report as Report }));
}

export default async function SupplyChainPage() {
  const allRows = await getAllRows();
  const lastUpdated = new Date().toISOString().slice(0, 10);

  // Latest report per company
  const latestByCompany = new Map<string, Row>();
  for (const r of allRows) {
    if (!latestByCompany.has(r.companySlug)) {
      latestByCompany.set(r.companySlug, r);
    }
  }

  // --- Scorecard: latest segment-level score ---
  type ScoreCard = {
    segmentId: SegmentId;
    segmentName: string;
    score: number | null;
    latest?: Row & { companyName: string; ticker: string; flag: string; vsConsensus: string };
  };
  const scorecards: ScoreCard[] = segments.map((seg) => {
    const segCompanies = companies.filter((c) => c.segmentId === seg.id);
    const latestRows = segCompanies
      .map((c) => latestByCompany.get(c.slug))
      .filter((r): r is Row => Boolean(r));
    if (latestRows.length === 0) {
      return { segmentId: seg.id, segmentName: seg.name, score: null };
    }
    const score = avg(latestRows.map((r) => reportAvgScore(r.report)));
    const newest = latestRows[0];
    const c = getCompanyBySlug(newest.companySlug)!;
    return {
      segmentId: seg.id,
      segmentName: seg.name,
      score: Math.round(score * 10) / 10,
      latest: {
        ...newest,
        companyName: c.name,
        ticker: c.ticker,
        flag: flagForExchange(c.exchange),
        vsConsensus: newest.report.executiveSummary.vsConsensus,
      },
    };
  });

  // --- Heatmap: segment × calendar quarter, avg score per cell ---
  // Use companies' actual reportedAt to bucket into CY quarters
  const cellScores = new Map<string, { sum: number; count: number; samples: string[] }>();
  const allQuarters = new Set<string>();
  for (const r of allRows) {
    const c = getCompanyBySlug(r.companySlug);
    if (!c) continue;
    const cq = calendarQuarter(new Date(r.reportedAt));
    allQuarters.add(cq);
    const key = `${c.segmentId}|${cq}`;
    const cell = cellScores.get(key) ?? { sum: 0, count: 0, samples: [] };
    cell.sum += reportAvgScore(r.report);
    cell.count += 1;
    cell.samples.push(c.name);
    cellScores.set(key, cell);
  }
  const sortedQuarters = Array.from(allQuarters).sort();

  // --- Themes: aggregate cross-cutting themes by company count ---
  type ThemeAgg = { count: number; sentimentMix: Record<string, number>; companies: Set<string> };
  const themeAgg = new Map<string, ThemeAgg>();
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
    .slice(0, 15);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Supply Chain Health</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Quarterly snapshot · updated {lastUpdated}
        </p>
      </div>

      {/* Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
        {scorecards.map((s) => (
          <div
            key={s.segmentId}
            className="border border-zinc-200 dark:border-zinc-800 rounded-md p-4"
          >
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
              {s.segmentName}
            </div>
            <div
              className={`text-3xl font-mono tabular-nums mb-2 px-2 py-1 rounded inline-block ${heatColor(s.score)}`}
            >
              {s.score ?? "—"}
            </div>
            {s.latest ? (
              <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Latest:{" "}
                <Link
                  href={`/earnings/${s.latest.eventId}`}
                  className="hover:underline"
                >
                  {s.latest.flag} {s.latest.companyName}
                </Link>{" "}
                · {s.latest.fiscalPeriod} ·{" "}
                <span className="uppercase font-mono">{s.latest.vsConsensus}</span>
              </div>
            ) : (
              <div className="text-xs text-zinc-500">No company data</div>
            )}
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="mb-10">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
          Quarterly Heatmap
        </h2>
        {sortedQuarters.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Will populate as more quarters are analyzed.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left py-2 font-medium">Segment</th>
                {sortedQuarters.map((q) => (
                  <th key={q} className="text-center py-2 font-medium font-mono">
                    {q}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr key={seg.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 font-medium">{seg.name}</td>
                  {sortedQuarters.map((q) => {
                    const cell = cellScores.get(`${seg.id}|${q}`);
                    const score = cell ? cell.sum / cell.count : null;
                    const rounded = score === null ? null : Math.round(score * 10) / 10;
                    return (
                      <td key={q} className="py-2 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded font-mono tabular-nums text-xs ${heatColor(score)}`}
                          title={cell ? `${cell.count} report(s): ${cell.samples.join(", ")}` : "no data"}
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
        )}
      </div>

      {/* Top cross-cutting themes */}
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
          Top Cross-Cutting Themes
        </h2>
        {topThemes.length === 0 ? (
          <p className="text-sm text-zinc-500">No themes yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
            {topThemes.map(([name, agg]) => {
              const dominantSentiment = Object.entries(agg.sentimentMix).sort(
                (a, b) => b[1] - a[1],
              )[0]?.[0];
              return (
                <li key={name} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {agg.companies.size} compan{agg.companies.size === 1 ? "y" : "ies"} ·{" "}
                      mostly {dominantSentiment}
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
                                ? "bg-emerald-100 dark:bg-emerald-900/40"
                                : s === "negative"
                                  ? "bg-red-100 dark:bg-red-900/40"
                                  : s === "mixed"
                                    ? "bg-amber-100 dark:bg-amber-900/40"
                                    : "bg-zinc-100 dark:bg-zinc-800"
                            }`}
                          >
                            {s[0]}:{agg.sentimentMix[s]}
                          </span>
                        ),
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
