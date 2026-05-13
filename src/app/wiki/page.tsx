import Link from "next/link";
import { companies, getCompaniesBySegment } from "@/data/companies";
import { segments } from "@/data/segments";
import { db } from "@/lib/db";
import { earningsEvents, analyses } from "@/lib/db/schema";
import { sql, eq, desc } from "drizzle-orm";
import { flagForExchange } from "@/lib/helpers";
import type { Report } from "@/lib/analyzer/schema";

export const dynamic = "force-dynamic";

const VERDICT_DOT: Record<string, string> = {
  beat: "bg-green-500",
  miss: "bg-red-500",
  inline: "bg-gray-400",
  unknown: "bg-gray-300",
};

export default async function WikiPage() {
  // Latest event per company with vs-consensus
  const rows = await db
    .select({
      companySlug: earningsEvents.companySlug,
      report: analyses.report,
    })
    .from(analyses)
    .innerJoin(earningsEvents, eq(analyses.eventId, earningsEvents.id))
    .orderBy(desc(earningsEvents.reportedAt));

  const latestPerCompany = new Map<string, Report>();
  for (const r of rows) {
    if (!latestPerCompany.has(r.companySlug)) {
      latestPerCompany.set(r.companySlug, r.report as Report);
    }
  }

  // Themes aggregation
  const themeCounts = new Map<string, number>();
  for (const r of rows) {
    const rep = r.report as Report;
    for (const t of rep.crossCuttingThemes) {
      themeCounts.set(t.name, (themeCounts.get(t.name) ?? 0) + 1);
    }
  }
  const topThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const totalCompanies = companies.length;
  const reportedCount = latestPerCompany.size;
  const lastUpdated = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Knowledge Wiki</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalCompanies} companies across {segments.length} segments · {reportedCount}{" "}
            with earnings data
          </p>
        </div>
        <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded text-xs font-semibold">
          Updated {lastUpdated}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {segments.map((seg) => {
          const segCompanies = getCompaniesBySegment(seg.id);
          const reported = segCompanies.filter((c) => latestPerCompany.has(c.slug));
          return (
            <div
              key={seg.id}
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-900">{seg.name}</h3>
                <div className="flex items-center gap-2">
                  {reported.length > 0 && (
                    <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-semibold">
                      {reported.length} reported
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{segCompanies.length} total</span>
                </div>
              </div>
              {reported.length === 0 ? (
                <p className="text-xs text-gray-400">No earnings data yet</p>
              ) : (
                <div className="space-y-1">
                  {segCompanies.map((c) => {
                    const rep = latestPerCompany.get(c.slug);
                    const verdict = rep?.executiveSummary.vsConsensus ?? "unknown";
                    return (
                      <div
                        key={c.slug}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1.5 mr-2 truncate">
                          <span className="text-sm">{flagForExchange(c.exchange)}</span>
                          <Link
                            href={`/companies/${c.slug}`}
                            className="text-gray-700 hover:text-blue-600 hover:underline truncate"
                          >
                            {c.name}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-gray-400">{c.ticker}</span>
                          <span
                            className={`w-2 h-2 rounded-full ${VERDICT_DOT[verdict]}`}
                            title={`vs consensus: ${verdict}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {topThemes.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-3">Themes</h3>
          <div className="flex flex-wrap gap-2">
            {topThemes.map(([name, count]) => (
              <span
                key={name}
                className="bg-white border border-gray-200 px-3 py-1 rounded-full text-xs text-gray-700"
              >
                {name}
                <span className="ml-1 text-gray-400">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
