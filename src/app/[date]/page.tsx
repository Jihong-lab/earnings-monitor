import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { earningsEvents, analyses } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCompanyBySlug } from "@/data/companies";
import { getSegmentById } from "@/data/segments";
import { flagForExchange, countryForExchange } from "@/lib/helpers";
import type { Report } from "@/lib/analyzer/schema";

export const dynamic = "force-dynamic";

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

export default async function DatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const rows = await db
    .select({
      eventId: earningsEvents.id,
      companySlug: earningsEvents.companySlug,
      fiscalPeriod: earningsEvents.fiscalPeriod,
      report: analyses.report,
    })
    .from(earningsEvents)
    .leftJoin(analyses, eq(earningsEvents.id, analyses.eventId))
    .where(sql`date(${earningsEvents.reportedAt}) = ${date}`)
    .orderBy(earningsEvents.companySlug);

  // Group by country
  const byCountry = new Map<string, typeof rows>();
  for (const r of rows) {
    const c = getCompanyBySlug(r.companySlug);
    const country = c ? countryForExchange(c.exchange) : "Other";
    if (!byCountry.has(country)) byCountry.set(country, []);
    byCountry.get(country)!.push(r);
  }
  const countries = Array.from(byCountry.keys()).sort();

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-blue-600 hover:underline mb-6 inline-block"
      >
        ← Back to all dates
      </Link>
      <h2 className="text-2xl font-bold mb-6">{date}</h2>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No earnings reports on this date.</p>
      ) : (
        countries.map((country) => {
          const list = byCountry.get(country)!;
          return (
            <section key={country} className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-1">
                {country}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((r) => {
                  const c = getCompanyBySlug(r.companySlug);
                  const seg = c ? getSegmentById(c.segmentId) : undefined;
                  const report = r.report as Report | null;
                  const verdict = report?.executiveSummary.vsConsensus ?? "unknown";
                  const oneLiner = report?.executiveSummary.oneLineAssessment;
                  return (
                    <div
                      key={r.eventId}
                      className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {c ? flagForExchange(c.exchange) : "🌐"}
                          </span>
                          <span className="font-bold text-sm">
                            {c?.ticker ?? r.companySlug}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${VERDICT_BADGE[verdict]}`}
                        >
                          {VERDICT_LABEL[verdict]}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">
                        {c?.name ?? r.companySlug}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{seg?.name ?? "—"}</span>
                        <span>{r.fiscalPeriod}</span>
                      </div>
                      {oneLiner && (
                        <p className="text-xs text-gray-600 line-clamp-2">{oneLiner}</p>
                      )}
                      <Link
                        href={`/earnings/${r.eventId}`}
                        className="text-xs text-blue-600 hover:underline mt-1"
                      >
                        View Report →
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
