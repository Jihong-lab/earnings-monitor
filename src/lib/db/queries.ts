import "server-only";
import { db } from "./index";
import { earningsEvents, analyses } from "./schema";
import type { NewEarningsEvent, NewAnalysis } from "./schema";
import { eq, desc, and } from "drizzle-orm";
import type { Report } from "@/lib/analyzer/schema";

export async function getEventsForCompany(companySlug: string) {
  return db
    .select()
    .from(earningsEvents)
    .where(eq(earningsEvents.companySlug, companySlug))
    .orderBy(desc(earningsEvents.reportedAt));
}

export async function getEventById(id: number) {
  const rows = await db
    .select()
    .from(earningsEvents)
    .where(eq(earningsEvents.id, id))
    .limit(1);
  return rows[0];
}

export async function getEventByCompanyAndPeriod(
  companySlug: string,
  fiscalPeriod: string,
) {
  const rows = await db
    .select()
    .from(earningsEvents)
    .where(
      and(
        eq(earningsEvents.companySlug, companySlug),
        eq(earningsEvents.fiscalPeriod, fiscalPeriod),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function getLatestAnalysisForEvent(eventId: number) {
  const rows = await db
    .select()
    .from(analyses)
    .where(eq(analyses.eventId, eventId))
    .orderBy(desc(analyses.createdAt))
    .limit(1);
  if (!rows[0]) return undefined;
  return { ...rows[0], report: rows[0].report as Report };
}

export async function createEarningsEvent(data: NewEarningsEvent) {
  const [row] = await db.insert(earningsEvents).values(data).returning();
  return row;
}

export async function saveAnalysis(data: NewAnalysis) {
  const [row] = await db.insert(analyses).values(data).returning();
  return row;
}

export async function getAllEventsWithCompanies() {
  return db
    .select()
    .from(earningsEvents)
    .orderBy(desc(earningsEvents.reportedAt));
}
