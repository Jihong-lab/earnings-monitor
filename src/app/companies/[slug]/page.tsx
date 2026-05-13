import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/data/companies";
import { getSegmentById } from "@/data/segments";
import { getEventsForCompany } from "@/lib/db/queries";
import { flagForExchange } from "@/lib/helpers";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = getCompanyBySlug(slug);
  if (!company) notFound();

  const segment = getSegmentById(company.segmentId);
  const events = await getEventsForCompany(slug);

  return (
    <div>
      <Link
        href="/wiki"
        className="text-sm text-blue-600 hover:underline mb-6 inline-block"
      >
        ← Back to Wiki
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">
            {flagForExchange(company.exchange)} {company.name}
          </h2>
          <div className="flex gap-3 text-sm text-gray-500">
            <span className="font-mono">{company.ticker}</span>
            <span>·</span>
            <span>{segment?.name}</span>
          </div>
        </div>
        <Link
          href={`/companies/${slug}/earnings/new`}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add earnings
        </Link>
      </div>

      <h3 className="text-sm font-bold text-gray-900 mb-3">Earnings reports</h3>
      {events.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
          No earnings reports yet for this company. The daily auto-fetcher will populate this
          when they next report.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/earnings/${e.id}`}
              className="block bg-white rounded-lg border border-gray-200 px-5 py-4 hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{e.fiscalPeriod}</span>
                <span className="text-sm text-gray-500">
                  Reported {new Date(e.reportedAt).toISOString().slice(0, 10)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
