import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.POSTGRES_URL!);
  const deleted = await sql`
    DELETE FROM earnings_events
    WHERE id IN (
      SELECT e.id
      FROM earnings_events e
      LEFT JOIN analyses a ON a.event_id = e.id
      WHERE a.id IS NULL
    )
    RETURNING id, company_slug, fiscal_period
  `;
  console.log(`Deleted ${deleted.length} orphan event(s):`);
  for (const e of deleted) console.log(`  - ${e.company_slug} ${e.fiscal_period}`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
