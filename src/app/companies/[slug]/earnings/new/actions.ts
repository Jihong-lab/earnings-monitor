"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCompanyBySlug } from "@/data/companies";
import {
  createEarningsEvent,
  saveAnalysis,
  getEventByCompanyAndPeriod,
} from "@/lib/db/queries";
import { analyzeEarnings } from "@/lib/analyzer";

export interface SubmitState {
  error?: string;
}

export async function submitEarningsAnalysis(
  slug: string,
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const company = getCompanyBySlug(slug);
  if (!company) return { error: "Unknown company" };

  const fiscalPeriod = String(formData.get("fiscalPeriod") ?? "").trim();
  const reportedAt = String(formData.get("reportedAt") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim() || null;
  const transcriptText = String(formData.get("transcriptText") ?? "").trim();
  const consensusRevenue = String(formData.get("consensusRevenue") ?? "").trim();
  const consensusEps = String(formData.get("consensusEps") ?? "").trim();
  const consensusNextQ = String(formData.get("consensusNextQ") ?? "").trim();

  if (!fiscalPeriod) return { error: "Fiscal period is required (e.g. CY2025Q4 or FY2026Q3)" };
  if (!reportedAt) return { error: "Reported date is required" };
  if (transcriptText.length < 200) return { error: "Transcript looks too short (under 200 chars)" };

  const existing = await getEventByCompanyAndPeriod(slug, fiscalPeriod);
  if (existing) {
    return { error: `An event for ${fiscalPeriod} already exists for ${company.name}` };
  }

  let eventId: number;
  try {
    const event = await createEarningsEvent({
      companySlug: slug,
      fiscalPeriod,
      reportedAt: new Date(reportedAt),
      sourceUrl,
      transcriptText,
    });
    eventId = event.id;
  } catch (err) {
    return { error: `Failed to save event: ${err instanceof Error ? err.message : String(err)}` };
  }

  const consensus =
    consensusRevenue || consensusEps || consensusNextQ
      ? {
          revenue: consensusRevenue || undefined,
          eps: consensusEps || undefined,
          nextQuarterRevenue: consensusNextQ || undefined,
        }
      : undefined;

  try {
    const result = await analyzeEarnings({
      companyName: company.name,
      ticker: company.ticker,
      fiscalPeriod,
      transcriptText,
      consensus,
    });
    await saveAnalysis({
      eventId,
      report: result.report,
      model: result.model,
    });
  } catch (err) {
    return {
      error: `Saved event ${eventId} but analysis failed: ${
        err instanceof Error ? err.message : String(err)
      }. You can retry analysis from the event page.`,
    };
  }

  revalidatePath(`/companies/${slug}`);
  revalidatePath(`/earnings/${eventId}`);
  redirect(`/earnings/${eventId}`);
}
