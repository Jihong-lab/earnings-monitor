import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/data/companies";
import { getSegmentById } from "@/data/segments";
import { getEventById, getLatestAnalysisForEvent } from "@/lib/db/queries";
import { flagForExchange } from "@/lib/helpers";
import type { Report } from "@/lib/analyzer/schema";

const VERDICT_BADGE: Record<string, string> = {
  beat: "bg-green-600 text-white",
  miss: "bg-red-600 text-white",
  inline: "bg-gray-500 text-white",
  unknown: "bg-gray-200 text-gray-700",
};

const VERDICT_LABEL: Record<string, string> = {
  beat: "BEAT",
  miss: "MISS",
  inline: "INLINE",
  unknown: "—",
};

const SENTIMENT_BADGE: Record<string, string> = {
  positive: "bg-green-100 text-green-800",
  negative: "bg-red-100 text-red-800",
  neutral: "bg-gray-100 text-gray-700",
  mixed: "bg-yellow-100 text-yellow-800",
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
  const reportedDate = new Date(event.reportedAt).toISOString().slice(0, 10);

  return (
    <div>
      <Link
        href={`/${reportedDate}`}
        className="text-sm text-blue-600 hover:underline mb-6 inline-block"
      >
        ← Back to {reportedDate}
      </Link>

      <article className="bg-white rounded-lg border border-gray-200 px-6 py-6 md:px-8">
        {/* Document header */}
        <header className="border-b-2 border-slate-700 pb-3 mb-6">
          <div className="text-xs text-gray-400 mb-2 font-mono">
            {company?.ticker ?? event.companySlug} · {reportedDate}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">
            {company ? `${flagForExchange(company.exchange)} ${company.name}` : event.companySlug}{" "}
            — {event.fiscalPeriod}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
            <span className="text-gray-600">
              <span className="text-gray-400">Segment:</span> {segment?.name ?? "—"}
            </span>
            <span className="text-gray-600">
              <span className="text-gray-400">Reported:</span> {reportedDate}
            </span>
            {event.sourceUrl && (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                Source ↗
              </a>
            )}
            {analysis && (
              <span
                className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded ${VERDICT_BADGE[analysis.report.executiveSummary.vsConsensus]}`}
              >
                {VERDICT_LABEL[analysis.report.executiveSummary.vsConsensus]}
              </span>
            )}
          </div>
        </header>

        {!analysis ? (
          <p className="text-sm text-gray-500">No analysis yet.</p>
        ) : (
          <ReportDoc
            report={analysis.report}
            model={analysis.model ?? "unknown"}
            createdAt={analysis.createdAt}
          />
        )}
      </article>
    </div>
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
      <Section title="1. Executive Summary">
        <p className="text-sm leading-relaxed text-gray-800 mb-3">
          <strong className="text-slate-900">Overall:</strong>{" "}
          {report.executiveSummary.oneLineAssessment}
        </p>
        <ul className="text-sm leading-relaxed text-gray-800 list-disc pl-5 space-y-1">
          {report.executiveSummary.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </Section>

      <Section title="2. Scores">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["revenueGrowth", "margins", "guidance", "sentiment"] as const).map((k) => {
            const score = report.scores[k];
            const color =
              score >= 70
                ? "text-green-600"
                : score >= 50
                  ? "text-yellow-600"
                  : "text-red-600";
            return (
              <div
                key={k}
                className="border border-gray-200 rounded p-3 text-center bg-gray-50"
              >
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  {SCORE_LABELS[k]}
                </div>
                <div className={`text-2xl font-bold font-mono ${color}`}>{score}</div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="3. Quarterly KPIs">
        <KpiTable kpis={report.quarterlyKpis} />
      </Section>

      {report.fullYearKpis.length > 0 && (
        <Section title="Full-Year KPIs">
          <KpiTable kpis={report.fullYearKpis} />
        </Section>
      )}

      {report.revenueMix.map((mb, i) => (
        <Section key={i} title={mb.dimension}>
          <DataTable
            headers={["Category", "Value", "Growth"]}
            rows={mb.entries.map((e) => [e.category, e.value ?? "—", e.growth ?? "—"])}
            numericFromCol={1}
          />
        </Section>
      ))}

      <Section title="4. Guidance">
        {report.guidance.nextPeriod.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-slate-700 mt-2 mb-2">Next period</h3>
            <DataTable
              headers={["Metric", "Guided", "Consensus", "Delta"]}
              rows={report.guidance.nextPeriod.map((g) => [
                g.metric,
                g.guided,
                g.consensus ?? "—",
                g.delta ?? "—",
              ])}
              numericFromCol={1}
            />
          </>
        )}
        {report.guidance.fullYearOutlook.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">
              Full-year outlook
            </h3>
            <ul className="text-sm text-gray-800 list-disc pl-5 space-y-1">
              {report.guidance.fullYearOutlook.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </>
        )}
        {report.guidance.positiveFactors.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-green-700 mt-4 mb-2">
              Positive factors
            </h3>
            <ul className="text-sm text-gray-800 list-disc pl-5 space-y-1">
              {report.guidance.positiveFactors.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </>
        )}
        {report.guidance.riskFactors.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-red-700 mt-4 mb-2">Risk factors</h3>
            <ul className="text-sm text-gray-800 list-disc pl-5 space-y-1">
              {report.guidance.riskFactors.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="5. Management Commentary">
        <div className="space-y-4">
          {report.managementRemarks.map((m, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                {m.topic}
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SENTIMENT_BADGE[m.sentiment]}`}
                >
                  {m.sentiment}
                </span>
              </h3>
              <p className="text-sm text-gray-800 leading-relaxed mt-1">{m.commentary}</p>
              {m.bestQuote && (
                <blockquote className="mt-2 pl-3 border-l-2 border-gray-300 text-sm italic text-gray-600">
                  &ldquo;{m.bestQuote}&rdquo;
                </blockquote>
              )}
            </div>
          ))}
        </div>
      </Section>

      {report.qaHighlights.length > 0 && (
        <Section title="6. Q&A Highlights">
          <div className="space-y-4">
            {report.qaHighlights.map((qa, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-slate-700">
                  Q{qa.analystFirm ? ` (${qa.analystFirm})` : ""}: {qa.question}
                </p>
                <p className="text-sm text-gray-800 leading-relaxed mt-1">A: {qa.response}</p>
                {qa.bestQuote && (
                  <blockquote className="mt-2 pl-3 border-l-2 border-gray-300 text-sm italic text-gray-600">
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
          <div className="flex flex-wrap gap-2">
            {report.crossCuttingThemes.map((t, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-0.5 rounded ${SENTIMENT_BADGE[t.sentiment]}`}
              >
                {t.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title="7. Investor Key Takeaways">
        <ol className="text-sm text-gray-800 leading-relaxed list-decimal pl-5 space-y-1.5">
          {report.investorTakeaways.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </Section>

      {report.flags.length > 0 && (
        <Section title="Flags">
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            {report.flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Section>
      )}

      <footer className="mt-8 pt-3 border-t border-gray-200 text-[10px] text-gray-400">
        Generated {new Date(createdAt).toISOString().slice(0, 19).replace("T", " ")} · Model:{" "}
        {model}
      </footer>
    </>
  );
}

const SCORE_LABELS = {
  revenueGrowth: "Rev Growth",
  margins: "Margins",
  guidance: "Guidance",
  sentiment: "Sentiment",
} as const;

function KpiTable({
  kpis,
}: {
  kpis: Array<{
    label: string;
    value: string | null;
    yoy: string | null;
    qoq: string | null;
    vsConsensus: string | null;
  }>;
}) {
  return (
    <DataTable
      headers={["Metric", "Value", "YoY", "QoQ", "vs Cons"]}
      rows={kpis.map((k) => [
        k.label,
        k.value ?? "—",
        k.yoy ?? "—",
        k.qoq ?? "—",
        k.vsConsensus ?? "—",
      ])}
      numericFromCol={1}
    />
  );
}

function DataTable({
  headers,
  rows,
  numericFromCol = 1,
}: {
  headers: string[];
  rows: (string | number)[][];
  numericFromCol?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-gray-300">
        <thead>
          <tr className="bg-slate-700 text-white">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-2.5 py-2 font-semibold border border-slate-700 ${
                  i < numericFromCol ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 1 ? "bg-gray-50" : ""}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-2.5 py-1.5 border border-gray-200 ${
                    j === 0
                      ? "font-medium text-gray-900 bg-gray-50"
                      : j >= numericFromCol
                        ? "text-right font-mono tabular-nums text-gray-800"
                        : "text-gray-800"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-bold text-slate-700 border-b border-gray-300 pb-1 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}
