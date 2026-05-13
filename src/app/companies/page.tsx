import Link from "next/link";
import { segments } from "@/data/segments";
import { companies } from "@/data/companies";
import type { SegmentId } from "@/data/types";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const { segment: segmentFilter } = await searchParams;
  const filteredSegments = segmentFilter
    ? segments.filter((s) => s.id === segmentFilter)
    : segments;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        {segmentFilter && (
          <Link
            href="/companies"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Clear filter →
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/companies"
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            !segmentFilter
              ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
              : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-500"
          }`}
        >
          All ({companies.length})
        </Link>
        {segments.map((s) => {
          const count = companies.filter((c) => c.segmentId === s.id).length;
          const active = segmentFilter === s.id;
          return (
            <Link
              key={s.id}
              href={`/companies?segment=${s.id}`}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                active
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-500"
              }`}
            >
              {s.name} ({count})
            </Link>
          );
        })}
      </div>

      <div className="space-y-10">
        {filteredSegments.map((segment) => {
          const segmentCompanies = companies.filter(
            (c) => c.segmentId === (segment.id as SegmentId)
          );
          return (
            <section key={segment.id}>
              <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
                {segment.name}
              </h2>
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
                {segmentCompanies.map((c) => (
                  <li key={c.slug} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{c.ticker}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {c.exchange}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
