import { NextResponse } from "next/server";
import { companies } from "@/data/companies";
import { db } from "@/lib/db";
import { earningsEvents, analyses, cronRuns } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { autoAnalyzeFromWeb } from "@/lib/analyzer/auto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface CompanyResult {
  slug: string;
  ticker: string;
  status: "new" | "no_new_earnings" | "error";
  fiscalPeriod?: string;
  reason?: string;
  errorMessage?: string;
  quickTokens?: { in: number; out: number; tools: number };
  deepTokens?: { in: number; out: number; tools: number };
}

async function getLastKnownPeriod(companySlug: string): Promise<string | null> {
  const rows = await db
    .select({ fiscalPeriod: earningsEvents.fiscalPeriod })
    .from(earningsEvents)
    .where(eq(earningsEvents.companySlug, companySlug))
    .orderBy(desc(earningsEvents.reportedAt))
    .limit(1);
  return rows[0]?.fiscalPeriod ?? null;
}

async function processCompany(
  company: (typeof companies)[number],
): Promise<CompanyResult> {
  const base = { slug: company.slug, ticker: company.ticker };
  try {
    const lastKnownPeriod = await getLastKnownPeriod(company.slug);
    const { result, meta } = await autoAnalyzeFromWeb({
      companyName: company.name,
      ticker: company.ticker,
      lastKnownPeriod,
    });

    const tokens = {
      quickTokens: { in: meta.quickInputTokens, out: meta.quickOutputTokens, tools: meta.quickToolCalls },
      deepTokens: { in: meta.deepInputTokens, out: meta.deepOutputTokens, tools: meta.deepToolCalls },
    };

    if (result.status === "no_new_earnings") {
      return {
        ...base,
        status: "no_new_earnings",
        reason: result.reason,
        ...tokens,
      };
    }

    // Persist new event + analysis
    const [event] = await db
      .insert(earningsEvents)
      .values({
        companySlug: company.slug,
        fiscalPeriod: result.fiscalPeriod,
        reportedAt: new Date(result.reportedAt),
        sourceUrl: result.sourceUrls[0] ?? null,
        transcriptText: null,
      })
      .onConflictDoNothing({
        target: [earningsEvents.companySlug, earningsEvents.fiscalPeriod],
      })
      .returning();

    if (!event) {
      // Already existed
      return {
        ...base,
        status: "no_new_earnings",
        reason: `Already have ${result.fiscalPeriod} for ${company.slug}`,
        ...tokens,
      };
    }

    await db.insert(analyses).values({
      eventId: event.id,
      report: result.report,
      model: meta.model,
    });

    return {
      ...base,
      status: "new",
      fiscalPeriod: result.fiscalPeriod,
      ...tokens,
    };
  } catch (err) {
    return {
      ...base,
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function handleCronRequest(request: Request): Promise<Response> {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const onlySlug = url.searchParams.get("only");
  const filteredCompanies = onlySlug
    ? companies.filter((c) => c.slug === onlySlug)
    : companies;

  if (filteredCompanies.length === 0) {
    return NextResponse.json({ error: `No company matches "${onlySlug}"` }, { status: 404 });
  }

  const [run] = await db
    .insert(cronRuns)
    .values({ companiesChecked: 0, newReportsCreated: 0 })
    .returning();

  const results = await runInBatches(filteredCompanies, 3, processCompany);

  const newCount = results.filter((r) => r.status === "new").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const errors = results.filter((r) => r.status === "error");

  await db
    .update(cronRuns)
    .set({
      finishedAt: new Date(),
      companiesChecked: results.length,
      newReportsCreated: newCount,
      errors: errorCount > 0 ? errors : null,
      summary: { results },
    })
    .where(eq(cronRuns.id, run.id));

  return NextResponse.json({
    runId: run.id,
    companiesChecked: results.length,
    newReportsCreated: newCount,
    errorCount,
    results,
  });
}

export async function GET(request: Request) {
  return handleCronRequest(request);
}

export async function POST(request: Request) {
  return handleCronRequest(request);
}
