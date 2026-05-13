import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/data/companies";
import { getSegmentById } from "@/data/segments";
import { getEventById, getLatestAnalysisForEvent } from "@/lib/db/queries";
import { flagForExchange } from "@/lib/helpers";
import type { Report } from "@/lib/analyzer/schema";

const VS_CONS_LABEL: Record<string, { label: string; cls: string }> = {
  beat: { label: "BEAT", cls: "bg-emerald-700 text-white" },
  miss: { label: "MISS", cls: "bg-red-700 text-white" },
  inline: { label: "INLINE", cls: "bg-zinc-600 text-white" },
  unknown: { label: "—", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
};

export default async function EarningsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number.parseInt(idStr, 10);
  if (Number.isNaN(id)) notFound();

  const event = await getEventById(id);
  if (!event) notFound();

  const company = getCompanyBySlug(event.companySlug);
  const segment = company ? getSegmentById(company.segmentId) : undefined;
  const analysis = await getLatestAnalysisForEvent(id);

  return (
    <article className="max-w-3xl mx-auto px-6 py-10 font-serif">
      {/* Document header */}
      <header className="border-b border-zinc-300 dark:border-zinc-700 pb-6 mb-8">
        <Link
          href="/"
          className="font-sans text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← All earnings
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mt-2 mb-1">
          {company ? `${flagForExchange(company.exchange)} ${company.name}` : event.companySlug}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 font-sans">
          {company?.ticker ?? event.companySlug} · {segment?.name ?? ""} · {event.fiscalPeriod} ·
          Reported {new Date(event.reportedAt).toISOString().slice(0, 10)}
          {event.sourceUrl && (
            <>
              {" · "}
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Source
              </a>
            </>
          )}
        </p>
        {analysis && (
          <div className="mt-4">
            <span
              className={`font-sans text-xs px-2 py-1 rounded uppercase tracking-wider ${
                VS_CONS_LABEL[analysis.report.executiveSummary.vsConsensus].cls
              }`}
            >
              vs Consensus: {VS_CONS_LABEL[analysis.report.executiveSummary.vsConsensus].label}
            </span>
          </div>
        )}
      </header>

      {!analysis ? (
        <p className="text-sm text-zinc-500 font-sans">No analysis yet.</p>
      ) : (
        <ReportDoc report={analysis.report} model={analysis.model ?? "unknown"} createdAt={analysis.createdAt} />
      )}
    </article>
  );
}

function ReportDoc({
  report,
  model,
  createdAt,
}: {
  report: Report;
  model: string;
  createdAt: Date;
}) {
  return (
    <>
      <Section title="Executive Summary">
        <p className="text-base leading-relaxed mb-3">
          {report.executiveSummary.oneLineAssessment}
        </p>
        <ul className="text-sm leading-relaxed space-y-1.5 list-disc pl-5">
          {report.executiveSummary.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </Section>

      <Section title="Scores">
        <div className="font-sans text-sm">
          <table className="w-full">
            <tbody>
              {(["revenueGrowth", "margins", "guidance", "sentiment"] as const).map((k) => (
                <tr key={k} className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{SCORE_LABELS[k]}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{report.scores[k]} / 100</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Quarterly KPIs">
        <KpiTable kpis={report.quarterlyKpis} />
      </Section>

      {report.fullYearKpis.length > 0 && (
        <Section title="Full-Year KPIs">
          <KpiTable kpis={report.fullYearKpis} />
        </Section>
      )}

      {report.revenueMix.map((mb, i) => (
        <Section key={i} title={mb.dimension}>
          <table className="w-full text-sm font-sans">
            <tbody>
              {mb.entries.map((e, j) => (
                <tr key={j} className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-1.5">{e.category}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{e.value}</td>
                  <td className="py-1.5 text-right text-zinc-500 text-xs font-mono">
                    {e.growth ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ))}

      <Section title="Guidance">
        {report.guidance.nextPeriod.length > 0 && (
          <>
            <h3 className="text-sm font-semibold mt-1 mb-2 font-sans">Next period</h3>
            <table className="w-full text-sm font-sans mb-4">
              <thead className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="text-left py-1.5 font-medium">Metric</th>
                  <th className="text-right py-1.5 font-medium">Guided</th>
                  <th className="text-right py-1.5 font-medium">Consensus</th>
                  <th className="text-right py-1.5 font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {report.guidance.nextPeriod.map((g, i) => (
                  <tr key={i} className="border-b border-zinc-200 dark:border-zinc-800">
                    <td className="py-1.5">{g.metric}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{g.guided}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-zinc-500">
                      {g.consensus ?? "—"}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-zinc-500">
                      {g.delta ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {report.guidance.fullYearOutlook.length > 0 && (
          <>
            <h3 className="text-sm font-semibold mt-3 mb-2 font-sans">Full-year outlook</h3>
            <ul className="text-sm leading-relaxed space-y-1.5 list-disc pl-5 mb-4">
              {report.guidance.fullYearOutlook.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </>
        )}
        {report.guidance.positiveFactors.length > 0 && (
          <>
            <h3 className="text-sm font-semibold mt-3 mb-2 font-sans">Positive factors</h3>
            <ul className="text-sm leading-relaxed space-y-1.5 list-disc pl-5 mb-4">
              {report.guidance.positiveFactors.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </>
        )}
        {report.guidance.riskFactors.length > 0 && (
          <>
            <h3 className="text-sm font-semibold mt-3 mb-2 font-sans">Risk factors</h3>
            <ul className="text-sm leading-relaxed space-y-1.5 list-disc pl-5">
              {report.guidance.riskFactors.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Management Commentary">
        <div className="space-y-5">
          {report.managementRemarks.map((m, i) => (
            <div key={i}>
              <h3 className="font-semibold mb-1">{m.topic}</h3>
              <p className="text-sm leading-relaxed">{m.commentary}</p>
              {m.bestQuote && (
                <blockquote className="mt-2 pl-4 border-l-2 border-zinc-300 dark:border-zinc-700 text-sm italic text-zinc-700 dark:text-zinc-300">
                  &ldquo;{m.bestQuote}&rdquo;
                </blockquote>
              )}
            </div>
          ))}
        </div>
      </Section>

      {report.qaHighlights.length > 0 && (
        <Section title="Q&A Highlights">
          <div className="space-y-5">
            {report.qaHighlights.map((qa, i) => (
              <div key={i}>
                <p className="text-sm font-semibold">
                  Q{qa.analystFirm ? ` (${qa.analystFirm})` : ""}: {qa.question}
                </p>
                <p className="text-sm leading-relaxed mt-1">A: {qa.response}</p>
                {qa.bestQuote && (
                  <blockquote className="mt-2 pl-4 border-l-2 border-zinc-300 dark:border-zinc-700 text-sm italic text-zinc-700 dark:text-zinc-300">
                    &ldquo;{qa.bestQuote}&rdquo;
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.crossCuttingThemes.length > 0 && (
        <Section title="Themes">
          <div className="font-sans text-sm">
            {report.crossCuttingThemes.map((t, i) => (
              <span key={i}>
                {i > 0 && <span className="text-zinc-400">, </span>}
                <Link
                  href={`/wiki?theme=${encodeURIComponent(t.name)}`}
                  className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  {t.name}
                </Link>
                <span className="text-xs text-zinc-500"> ({t.sentiment})</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title="Investor Key Takeaways">
        <ol className="text-sm leading-relaxed space-y-2 list-decimal pl-5">
          {report.investorTakeaways.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </Section>

      {report.flags.length > 0 && (
        <Section title="Flags">
          <ul className="text-sm leading-relaxed space-y-1.5 list-disc pl-5 text-zinc-700 dark:text-zinc-300">
            {report.flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Section>
      )}

      <footer className="mt-12 pt-4 border-t border-zinc-300 dark:border-zinc-700 font-sans text-xs text-zinc-500">
        Generated {new Date(createdAt).toISOString().slice(0, 19).replace("T", " ")} · Model: {model}
      </footer>
    </>
  );
}

const SCORE_LABELS = {
  revenueGrowth: "Revenue Growth",
  margins: "Margins",
  guidance: "Guidance",
  sentiment: "Sentiment",
} as const;

function KpiTable({
  kpis,
}: {
  kpis: Array<{
    label: string;
    value: string;
    yoy: string | null;
    qoq: string | null;
    vsConsensus: string | null;
  }>;
}) {
  return (
    <table className="w-full text-sm font-sans">
      <thead className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
        <tr>
          <th className="text-left py-1.5 font-medium">Metric</th>
          <th className="text-right py-1.5 font-medium">Value</th>
          <th className="text-right py-1.5 font-medium">YoY</th>
          <th className="text-right py-1.5 font-medium">QoQ</th>
          <th className="text-right py-1.5 font-medium">vs Cons</th>
        </tr>
      </thead>
      <tbody>
        {kpis.map((k, i) => (
          <tr key={i} className="border-b border-zinc-200 dark:border-zinc-800">
            <td className="py-1.5">{k.label}</td>
            <td className="py-1.5 text-right font-mono tabular-nums">{k.value}</td>
            <td className="py-1.5 text-right font-mono tabular-nums text-zinc-500">
              {k.yoy ?? "—"}
            </td>
            <td className="py-1.5 text-right font-mono tabular-nums text-zinc-500">
              {k.qoq ?? "—"}
            </td>
            <td className="py-1.5 text-right font-mono tabular-nums text-zinc-500">
              {k.vsConsensus ?? "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-sans text-xs uppercase tracking-wider text-zinc-500 mb-3 border-b border-zinc-200 dark:border-zinc-800 pb-1">
        {title}
      </h2>
      {children}
    </section>
  );
}
