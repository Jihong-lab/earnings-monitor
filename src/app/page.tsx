import Link from "next/link";
import { companies, getCompanyBySlug } from "@/data/companies";
import { getAllEventsWithCompanies } from "@/lib/db/queries";
import { formatDate } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const byCompany = view === "company";
  const events = await getAllEventsWithCompanies();

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <Link
          href="/"
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            !byCompany
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          By Date
        </Link>
        <Link
          href="/?view=company"
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            byCompany
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          By Company
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState />
      ) : byCompany ? (
        <ByCompanyView events={events} />
      ) : (
        <ByDateView events={events} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
      No earnings reports yet. The daily auto-fetcher will populate this as companies report.
    </div>
  );
}

function ByDateView({
  events,
}: {
  events: Awaited<ReturnType<typeof getAllEventsWithCompanies>>;
}) {
  const byDate = new Map<string, typeof events>();
  for (const e of events) {
    const d = formatDate(e.reportedAt);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(e);
  }
  const dates = Array.from(byDate.keys()).sort().reverse();

  return (
    <div className="space-y-2">
      {dates.map((date) => {
        const list = byDate.get(date)!;
        const names = list
          .map((e) => getCompanyBySlug(e.companySlug)?.name ?? e.companySlug)
          .join(", ");
        return (
          <Link
            key={date}
            href={`/${date}`}
            className="block bg-white rounded-lg border border-gray-200 px-5 py-4 hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{date}</span>
              <span className="text-sm text-gray-500">
                {list.length} {list.length === 1 ? "company" : "companies"}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-1 truncate">{names}</div>
          </Link>
        );
      })}
    </div>
  );
}

function ByCompanyView({
  events,
}: {
  events: Awaited<ReturnType<typeof getAllEventsWithCompanies>>;
}) {
  const bySlug = new Map<string, typeof events>();
  for (const e of events) {
    if (!bySlug.has(e.companySlug)) bySlug.set(e.companySlug, []);
    bySlug.get(e.companySlug)!.push(e);
  }
  const orderedSlugs = companies.map((c) => c.slug).filter((slug) => bySlug.has(slug));

  return (
    <div className="space-y-2">
      {orderedSlugs.map((slug) => {
        const c = getCompanyBySlug(slug)!;
        const list = bySlug.get(slug)!;
        return (
          <Link
            key={slug}
            href={`/companies/${slug}`}
            className="block bg-white rounded-lg border border-gray-200 px-5 py-4 hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-gray-400 font-mono ml-2">{c.ticker}</span>
              </div>
              <span className="text-sm text-gray-500">
                {list.length} {list.length === 1 ? "report" : "reports"}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-1 truncate">
              {list.map((e) => e.fiscalPeriod).join(", ")}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
