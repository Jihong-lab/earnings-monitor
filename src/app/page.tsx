import Link from "next/link";
import { companies, getCompanyBySlug } from "@/data/companies";
import { getAllEventsWithCompanies } from "@/lib/db/queries";
import { flagForExchange, formatDate } from "@/lib/helpers";

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
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex gap-4 mb-6 text-sm border-b border-zinc-200 dark:border-zinc-800">
        <Link
          href="/"
          className={`pb-2 -mb-px ${
            !byCompany
              ? "border-b-2 border-zinc-900 dark:border-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          By Date
        </Link>
        <Link
          href="/?view=company"
          className={`pb-2 -mb-px ${
            byCompany
              ? "border-b-2 border-zinc-900 dark:border-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
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
    <div className="text-sm text-zinc-600 dark:text-zinc-400 py-8">
      No earnings reports yet. Visit the{" "}
      <Link href="/wiki" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
        Wiki
      </Link>{" "}
      to pick a company and add its first report.
    </div>
  );
}

function ByDateView({ events }: { events: Awaited<ReturnType<typeof getAllEventsWithCompanies>> }) {
  const byDate = new Map<string, typeof events>();
  for (const e of events) {
    const d = formatDate(e.reportedAt);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(e);
  }
  const dates = Array.from(byDate.keys()).sort().reverse();

  return (
    <div className="space-y-6">
      {dates.map((date) => {
        const list = byDate.get(date)!;
        return (
          <div key={date}>
            <Link
              href={`/${date}`}
              className="font-mono text-sm text-zinc-900 dark:text-zinc-100 hover:underline"
            >
              {date}
            </Link>
            <span className="text-sm text-zinc-500 ml-3">
              {list.length} {list.length === 1 ? "company" : "companies"}
            </span>
            <div className="mt-1.5 text-sm">
              {list.map((e, i) => {
                const c = getCompanyBySlug(e.companySlug);
                return (
                  <span key={e.id}>
                    {i > 0 && <span className="text-zinc-400">, </span>}
                    <Link
                      href={`/earnings/${e.id}`}
                      className="hover:underline"
                    >
                      {c ? `${flagForExchange(c.exchange)} ${c.name}` : e.companySlug}
                    </Link>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ByCompanyView({ events }: { events: Awaited<ReturnType<typeof getAllEventsWithCompanies>> }) {
  const bySlug = new Map<string, typeof events>();
  for (const e of events) {
    if (!bySlug.has(e.companySlug)) bySlug.set(e.companySlug, []);
    bySlug.get(e.companySlug)!.push(e);
  }
  const orderedSlugs = companies
    .map((c) => c.slug)
    .filter((slug) => bySlug.has(slug));

  return (
    <div className="space-y-4">
      {orderedSlugs.map((slug) => {
        const c = getCompanyBySlug(slug)!;
        const list = bySlug.get(slug)!;
        return (
          <div key={slug}>
            <Link
              href={`/companies/${slug}`}
              className="font-medium hover:underline"
            >
              {flagForExchange(c.exchange)} {c.name}
            </Link>
            <span className="text-sm text-zinc-500 ml-3 font-mono">{c.ticker}</span>
            <div className="mt-1 text-sm">
              {list.map((e, i) => (
                <span key={e.id}>
                  {i > 0 && <span className="text-zinc-400">, </span>}
                  <Link href={`/earnings/${e.id}`} className="hover:underline">
                    {e.fiscalPeriod}
                  </Link>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
