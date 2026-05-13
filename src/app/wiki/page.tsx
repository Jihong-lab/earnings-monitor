import Link from "next/link";
import { companies, getCompaniesBySegment } from "@/data/companies";
import { segments } from "@/data/segments";
import { db } from "@/lib/db";
import { earningsEvents, analyses } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { flagForExchange } from "@/lib/helpers";
import type { Report } from "@/lib/analyzer/schema";

export const dynamic = "force-dynamic";

export default async function WikiPage() {
  // Companies with at least one earnings event
  const eventRows = await db
    .select({ companySlug: earningsEvents.companySlug })
    .from(earningsEvents)
    .groupBy(earningsEvents.companySlug);
  const reportedSlugs = new Set(eventRows.map((r) => r.companySlug));

  // Aggregate cross-cutting themes across all analyses
  const analysisRows = await db.select({ report: analyses.report }).from(analyses);
  const themeCounts = new Map<string, number>();
  for (const row of analysisRows) {
    const r = row.report as Report | null;
    if (!r) continue;
    for (const t of r.crossCuttingThemes) {
      themeCounts.set(t.name, (themeCounts.get(t.name) ?? 0) + 1);
    }
  }
  const topThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const totalCompanies = companies.length;
  const reportedCount = reportedSlugs.size;
  const lastUpdated = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Wiki</h2>
        <p className="text-sm text-zinc-500 mt-1">
          {totalCompanies} companies across {segments.length} segments · {reportedCount} with
          earnings data · updated {lastUpdated}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {segments.map((seg) => {
          const segCompanies = getCompaniesBySegment(seg.id);
          const segReported = segCompanies.filter((c) => reportedSlugs.has(c.slug)).length;
          const sample = segCompanies.slice(0, 4);
          const more = segCompanies.length - sample.length;
          return (
            <div
              key={seg.id}
              className="border border-zinc-200 dark:border-zinc-800 rounded-md p-4"
            >
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-semibold">{seg.name}</h3>
                <span className="text-xs text-zinc-500 font-mono">
                  {segReported} reported / {segCompanies.length} total
                </span>
              </div>
              <p className="text-xs text-zinc-500 mb-3">{seg.description}</p>
              <ul className="text-sm space-y-1">
                {sample.map((c) => (
                  <li key={c.slug} className="flex items-baseline gap-2">
                    <span>{flagForExchange(c.exchange)}</span>
                    <Link
                      href={`/companies/${c.slug}`}
                      className="hover:underline truncate"
                    >
                      {c.name}
                    </Link>
                    <span className="text-xs text-zinc-500 font-mono ml-auto">
                      {c.ticker}
                    </span>
                  </li>
                ))}
                {more > 0 && (
                  <li className="text-xs text-zinc-500">+{more} more</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {topThemes.length > 0 && (
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
            Themes
          </h2>
          <div className="text-sm">
            {topThemes.map(([name, count], i) => (
              <span key={name}>
                {i > 0 && <span className="text-zinc-400">, </span>}
                <Link
                  href={`/wiki/themes/${encodeURIComponent(name)}`}
                  className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  {name}
                </Link>
                <span className="text-xs text-zinc-500"> ({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
