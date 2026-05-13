import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const earningsEvents = pgTable(
  "earnings_events",
  {
    id: serial("id").primaryKey(),
    companySlug: varchar("company_slug", { length: 64 }).notNull(),
    fiscalPeriod: varchar("fiscal_period", { length: 16 }).notNull(),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull(),
    sourceUrl: text("source_url"),
    transcriptText: text("transcript_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_company_period").on(
      table.companySlug,
      table.fiscalPeriod,
    ),
  ],
);

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => earningsEvents.id, { onDelete: "cascade" }),
  report: jsonb("report").notNull(),
  model: varchar("model", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cronRuns = pgTable("cron_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  companiesChecked: integer("companies_checked").notNull().default(0),
  newReportsCreated: integer("new_reports_created").notNull().default(0),
  errors: jsonb("errors"),
  summary: jsonb("summary"),
});

export type EarningsEvent = typeof earningsEvents.$inferSelect;
export type NewEarningsEvent = typeof earningsEvents.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
export type CronRun = typeof cronRuns.$inferSelect;
export type NewCronRun = typeof cronRuns.$inferInsert;
