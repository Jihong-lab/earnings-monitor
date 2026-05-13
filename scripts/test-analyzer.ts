import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { readFileSync } from "fs";
import { analyzeEarnings } from "../src/lib/analyzer";

async function main() {
  const transcript = readFileSync("scripts/fixtures/nvda-q3-fy26.txt", "utf-8");

  console.log("Calling Claude (this may take 60-120s for the full schema)...\n");
  const t0 = Date.now();

  const result = await analyzeEarnings({
    companyName: "Nvidia",
    ticker: "NVDA US",
    fiscalPeriod: "FY2026 Q3",
    transcriptText: transcript,
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const r = result.report;

  console.log(`Done in ${elapsed}s.\n`);
  console.log("=== USAGE ===");
  console.log(`Model: ${result.model}`);
  console.log(`Input tokens:        ${result.inputTokens}`);
  console.log(`Output tokens:       ${result.outputTokens}`);
  console.log(
    "Est. cost: $" +
      (
        (result.inputTokens * 5 + result.cacheCreationTokens * 6.25) / 1_000_000 +
        (result.outputTokens * 25) / 1_000_000 +
        (result.cacheReadTokens * 0.5) / 1_000_000
      ).toFixed(4),
  );

  console.log("\n=== EXECUTIVE SUMMARY ===");
  console.log(`vs Consensus: ${r.executiveSummary.vsConsensus.toUpperCase()}`);
  console.log(`One-liner: ${r.executiveSummary.oneLineAssessment}`);
  console.log("Highlights:");
  for (const h of r.executiveSummary.highlights) console.log(`  • ${h}`);

  console.log("\n=== SCORES ===");
  console.log(r.scores);

  console.log("\n=== QUARTERLY KPIS ===");
  for (const k of r.quarterlyKpis) {
    const yoy = k.yoy ? ` YoY ${k.yoy}` : "";
    const qoq = k.qoq ? ` QoQ ${k.qoq}` : "";
    const cons = k.vsConsensus ? ` [${k.vsConsensus}]` : "";
    console.log(`  ${k.label.padEnd(24)} ${k.value}${yoy}${qoq}${cons}`);
  }

  if (r.fullYearKpis.length > 0) {
    console.log("\n=== FY KPIS ===");
    for (const k of r.fullYearKpis) console.log(`  ${k.label}: ${k.value}`);
  }

  console.log("\n=== REVENUE MIX ===");
  for (const mb of r.revenueMix) {
    console.log(`  ${mb.dimension}:`);
    for (const e of mb.entries) {
      console.log(`    - ${e.category}: ${e.value}${e.growth ? ` (${e.growth})` : ""}`);
    }
  }

  console.log("\n=== GUIDANCE ===");
  console.log("Next period:");
  for (const g of r.guidance.nextPeriod) console.log(`  ${g.metric}: ${g.guided}${g.consensus ? ` vs cons ${g.consensus}` : ""}`);
  if (r.guidance.fullYearOutlook.length > 0) {
    console.log("FY outlook:");
    for (const f of r.guidance.fullYearOutlook) console.log(`  • ${f}`);
  }
  console.log("Positive factors:");
  for (const p of r.guidance.positiveFactors) console.log(`  + ${p}`);
  console.log("Risk factors:");
  for (const rf of r.guidance.riskFactors) console.log(`  - ${rf}`);

  console.log("\n=== MANAGEMENT REMARKS ===");
  for (const m of r.managementRemarks) {
    console.log(`\n[${m.sentiment.toUpperCase()}] ${m.topic}`);
    console.log(`  ${m.commentary}`);
    if (m.bestQuote) console.log(`  > "${m.bestQuote}"`);
  }

  console.log(`\n=== Q&A HIGHLIGHTS (${r.qaHighlights.length}) ===`);
  for (const qa of r.qaHighlights) {
    console.log(`\n${qa.analystFirm ? `(${qa.analystFirm}) ` : ""}Q: ${qa.question}`);
    console.log(`  A: ${qa.response}`);
    if (qa.bestQuote) console.log(`  > "${qa.bestQuote}"`);
  }

  console.log("\n=== CROSS-CUTTING THEMES ===");
  for (const t of r.crossCuttingThemes) {
    console.log(`  ${t.name} [${t.sentiment}]`);
  }

  console.log("\n=== INVESTOR TAKEAWAYS ===");
  r.investorTakeaways.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

  if (r.flags.length > 0) {
    console.log("\n=== FLAGS ===");
    for (const f of r.flags) console.log(`  ⚠ ${f}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
