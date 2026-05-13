import Link from "next/link";
import { segments } from "@/data/segments";
import { companies, getCompaniesBySegment } from "@/data/companies";

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <section className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          Earnings Monitor
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl">
          Automated quarterly earnings analysis across {companies.length} companies in US Tech, Asia Tech, and Asia Financials.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-4">
          Coverage by segment
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {segments.map((segment) => {
            const segmentCompanies = getCompaniesBySegment(segment.id);
            return (
              <Link
                key={segment.id}
                href={`/companies?segment=${segment.id}`}
                className="block p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-semibold">{segment.name}</h3>
                  <span className="text-2xl font-mono tabular-nums">
                    {segmentCompanies.length}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {segment.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
