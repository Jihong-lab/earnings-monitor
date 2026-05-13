import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/data/companies";
import { getSegmentById } from "@/data/segments";
import { getEventsForCompany } from "@/lib/db/queries";

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
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <Link
            href="/wiki"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Wiki
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">
            {company.name}
          </h1>
          <div className="flex gap-3 mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-mono">{company.ticker}</span>
            <span>·</span>
            <span>{segment?.name}</span>
          </div>
        </div>
        <Link
          href={`/companies/${slug}/earnings/new`}
          className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          + Add earnings
        </Link>
      </div>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
          Earnings reports
        </h2>
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-500">
            No earnings reports yet.{" "}
            <Link
              href={`/companies/${slug}/earnings/new`}
              className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Add the first one
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
            {events.map((e) => (
              <li key={e.id} className="py-3">
                <Link
                  href={`/earnings/${e.id}`}
                  className="flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900 -mx-2 px-2 py-1 rounded"
                >
                  <div>
                    <div className="font-medium">{e.fiscalPeriod}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      Reported {new Date(e.reportedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="text-zinc-400">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
