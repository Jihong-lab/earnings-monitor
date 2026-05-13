import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL not set");

  const sql = postgres(url);
  const tables = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log("Tables:");
  for (const t of tables) console.log("  -", t.table_name);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
