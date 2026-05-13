import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { readFileSync } from "fs";
import { analyzeEarnings } from "../src/lib/analyzer";

async function main() {
  const transcript = readFileSync("scripts/fixtures/nvda-q3-fy26.txt", "utf-8");

  console.log("Calling Claude (this may take 30-60s)...\n");
  const t0 = Date.now();

  const result = await analyzeEarnings({
    companyName: "Nvidia",
    ticker: "NVDA US",
    fiscalPeriod: "FY2026 Q3",
    transcriptText: transcript,
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s.\n`);
  console.log("=== USAGE ===");
  console.log(`Model: ${result.model}`);
  console.log(`Input tokens:        ${result.inputTokens}`);
  console.log(`Output tokens:       ${result.outputTokens}`);
  console.log(`Cache read tokens:   ${result.cacheReadTokens}`);
  console.log(`Cache created tokens:${result.cacheCreationTokens}`);
  console.log(
    "Est. cost: $" +
      (
        ((result.inputTokens * 5 + result.cacheCreationTokens * 6.25) / 1_000_000) +
        (result.outputTokens * 25) / 1_000_000 +
        (result.cacheReadTokens * 0.5) / 1_000_000
      ).toFixed(4),
  );

  console.log("\n=== SUMMARY ===");
  console.log(result.analysis.summary);

  console.log("\n=== SCORES (0-100) ===");
  console.log(result.analysis.scores);

  console.log("\n=== THEMES ===");
  for (const t of result.analysis.themes) {
    console.log(`\n[${t.sentiment.toUpperCase()}] ${t.name}`);
    console.log(`  ${t.description}`);
    for (const q of t.quotes) {
      console.log(`  > "${q}"`);
    }
  }

  if (result.analysis.flags.length > 0) {
    console.log("\n=== FLAGS ===");
    for (const f of result.analysis.flags) console.log(`  ⚠ ${f}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
