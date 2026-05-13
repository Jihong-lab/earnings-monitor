import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.POSTGRES_URL!);

  console.log("=== Events in DB ===");
  const events = await sql<{ company_slug: string; fiscal_period: string; reported_at: string; has_analysis: boolean }[]>`
    SELECT
      e.company_slug,
      e.fiscal_period,
      to_char(e.reported_at, 'YYYY-MM-DD') as reported_at,
      EXISTS (SELECT 1 FROM analyses a WHERE a.event_id = e.id) as has_analysis
    FROM earnings_events e
    ORDER BY e.reported_at DESC, e.company_slug
  `;
  for (const e of events) {
    console.log(
      `  ${e.company_slug.padEnd(12)} ${e.fiscal_period.padEnd(10)} ${e.reported_at} ${e.has_analysis ? "✓" : "✗ no analysis"}`,
    );
  }
  console.log(`Total: ${events.length} events`);

  console.log("\n=== Last cron run ===");
  const runs = await sql<{
    id: number;
    started_at: string;
    finished_at: string | null;
    companies_checked: number;
    new_reports_created: number;
    summary: unknown;
  }[]>`
    SELECT id, started_at, finished_at, companies_checked, new_reports_created, summary
    FROM cron_runs
    ORDER BY id DESC
    LIMIT 1
  `;
  if (runs[0]) {
    const r = runs[0];
    console.log(`Run #${r.id}`);
    console.log(`  started: ${r.started_at}`);
    console.log(`  finished: ${r.finished_at}`);
    console.log(`  checked: ${r.companies_checked}`);
    console.log(`  new reports: ${r.new_reports_created}`);
    const summary = (r.summary as { results?: Array<{ slug: string; status: string; fiscalPeriod?: string; errorMessage?: string }> }) ?? {};
    if (summary.results) {
      console.log("  per-company:");
      for (const c of summary.results) {
        const tag = c.status === "new" ? `NEW ${c.fiscalPeriod}` :
          c.status === "no_new_earnings" ? "no new" :
          `ERROR: ${c.errorMessage?.slice(0, 80)}`;
        console.log(`    ${c.slug.padEnd(12)} ${tag}`);
      }
    }
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
