import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";

interface CompanyRes {
  slug: string;
  status: string;
  fiscalPeriod?: string;
  errorMessage?: string;
}

async function main() {
  const sql = postgres(process.env.POSTGRES_URL!);
  const rows = await sql<
    { id: number; started_at: string; finished_at: string | null; summary: { results?: CompanyRes[] } | null }[]
  >`
    SELECT id, started_at, finished_at, summary
    FROM cron_runs
    ORDER BY id DESC
    LIMIT 6
  `;
  for (const r of rows) {
    console.log(`\nRun #${r.id} (${r.started_at} → ${r.finished_at ?? "not finished"})`);
    const results = r.summary?.results;
    if (!results) continue;
    for (const c of results) {
      console.log(
        `  ${c.slug.padEnd(15)} ${c.status} ${c.fiscalPeriod ?? ""} ${c.errorMessage ? "ERR: " + c.errorMessage.slice(0, 200) : ""}`,
      );
    }
  }
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
