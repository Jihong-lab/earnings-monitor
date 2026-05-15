import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";

// Pricing per 1M tokens
const PRICES = {
  haiku: { in: 1.0, out: 5.0 },
  opus: { in: 5.0, out: 25.0 },
};

interface PerCompany {
  status: string;
  quickTokens?: { in: number; out: number; tools: number };
  deepTokens?: { in: number; out: number; tools: number };
}

async function main() {
  const sql = postgres(process.env.POSTGRES_URL!);

  const runs = await sql<{ id: number; summary: { results?: PerCompany[] } | null; started_at: string }[]>`
    SELECT id, summary, started_at FROM cron_runs WHERE summary IS NOT NULL ORDER BY id
  `;

  let totalHaikuIn = 0,
    totalHaikuOut = 0,
    totalOpusIn = 0,
    totalOpusOut = 0;
  let runCount = 0;
  let companyCallsByStatus: Record<string, number> = {};

  for (const r of runs) {
    const results = r.summary?.results;
    if (!results) continue;
    runCount++;
    for (const c of results) {
      companyCallsByStatus[c.status] = (companyCallsByStatus[c.status] ?? 0) + 1;
      if (c.quickTokens) {
        totalHaikuIn += c.quickTokens.in;
        totalHaikuOut += c.quickTokens.out;
      }
      if (c.deepTokens) {
        totalOpusIn += c.deepTokens.in;
        totalOpusOut += c.deepTokens.out;
      }
    }
  }

  const haikuCost = (totalHaikuIn * PRICES.haiku.in + totalHaikuOut * PRICES.haiku.out) / 1_000_000;
  const opusCost = (totalOpusIn * PRICES.opus.in + totalOpusOut * PRICES.opus.out) / 1_000_000;
  const total = haikuCost + opusCost;

  console.log("=== Cron-run token usage (what was tracked) ===");
  console.log(`Cron runs analyzed:     ${runCount}`);
  console.log(`Company-call results:   ${Object.entries(companyCallsByStatus).map(([k,v]) => `${k}=${v}`).join(", ")}`);
  console.log("");
  console.log(`Haiku input tokens:     ${totalHaikuIn.toLocaleString()}`);
  console.log(`Haiku output tokens:    ${totalHaikuOut.toLocaleString()}`);
  console.log(`Opus input tokens:      ${totalOpusIn.toLocaleString()}`);
  console.log(`Opus output tokens:     ${totalOpusOut.toLocaleString()}`);
  console.log("");
  console.log(`Haiku cost:             $${haikuCost.toFixed(4)}`);
  console.log(`Opus cost:              $${opusCost.toFixed(4)}`);
  console.log(`Total (tracked):        $${total.toFixed(2)}`);
  console.log("");
  console.log("NOTE: The above counts the input_tokens field from Claude API responses.");
  console.log("Web search and web fetch tool calls have separate per-call charges that are");
  console.log("billed in addition. Each web_search ~$0.01, each web_fetch ~$0.01-0.05.");
  const totalToolCalls = runs.flatMap(r => r.summary?.results ?? [])
    .reduce((s, c) => s + (c.quickTokens?.tools ?? 0) + (c.deepTokens?.tools ?? 0), 0);
  const toolCost = totalToolCalls * 0.025; // rough midpoint estimate
  console.log(`Server tool calls:      ${totalToolCalls} (≈ $${toolCost.toFixed(2)} extra)`);
  console.log("");
  console.log(`Plus the initial $2.74 NVDA test before optimization,`);
  console.log(`and any failed runs that consumed tokens before erroring.`);
  console.log("");
  console.log(`ESTIMATED ALL-IN TOTAL:  $${(total + toolCost + 3).toFixed(2)} - $${(total + toolCost + 5).toFixed(2)}`);
  console.log("");
  console.log("For exact billed cost, check https://console.anthropic.com/settings/usage");

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
