import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { earningsEvents, analyses } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCompanyBySlug } from "@/data/companies";
import { getSegmentById } from "@/data/segments";
import { flagForExchange } from "@/lib/helpers";
import type { Report } from "@/lib/analyzer/schema";

export const dynamic = "force-dynamic";

const VS_CONS_COLORS: Record<string, string> = {
  beat: "bg-emerald-600 text-white",
  miss: "bg-red-600 text-white",
  inline: "bg-zinc-500 text-white",
  unknown: "bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
};

export default async function DatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  // Fetch events on this date, with their latest analysis (vs consensus)
  const rows = await db
    .select({
      event: earningsEvents,
      report: analyses.report,
    })
    .from(earningsEvents)
    .leftJoin(analyses, eq(earningsEvents.id, analyses.eventId))
    .where(sql`date(${earningsEvents.reportedAt}) = ${date}`)
    .orderBy(earningsEvents.companySlug);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← All dates
      </Link>
      <h2 className="text-2xl font-semibold tracking-tight mt-2 mb-6 font-mono">
        {date}
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No earnings reports on this date.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="text-left py-2 font-medium"></th>
              <th className="text-left py-2 font-medium">Ticker</th>
              <th className="text-left py-2 font-medium">Company</th>
              <th className="text-left py-2 font-medium">Segment</th>
              <th className="text-left py-2 font-medium">Period</th>
              <th className="text-left py-2 font-medium">vs Cons</th>
              <th className="text-right py-2 font-medium">Report</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ event: e, report: r }) => {
              const c = getCompanyBySlug(e.companySlug);
              const seg = c ? getSegmentById(c.segmentId) : undefined;
              const vsCons = (r as Report | null)?.executiveSummary.vsConsensus ?? "unknown";
              return (
                <tr key={e.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2.5 text-lg">{c ? flagForExchange(c.exchange) : "🌐"}</td>
                  <td className="py-2.5 font-mono text-xs">{c?.ticker ?? e.companySlug}</td>
                  <td className="py-2.5">{c?.name ?? e.companySlug}</td>
                  <td className="py-2.5 text-zinc-500">{seg?.name ?? "-"}</td>
                  <td className="py-2.5 font-mono text-xs">{e.fiscalPeriod}</td>
                  <td className="py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded uppercase tracking-wider ${VS_CONS_COLORS[vsCons]}`}
                    >
                      {vsCons}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <Link
                      href={`/earnings/${e.id}`}
                      className="text-zinc-700 dark:text-zinc-300 hover:underline"
                    >
                      Report →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
