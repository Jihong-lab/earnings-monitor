"use client";

import { useActionState } from "react";
import { submitEarningsAnalysis, type SubmitState } from "./actions";

export function AddEarningsForm({ slug }: { slug: string }) {
  const boundAction = submitEarningsAnalysis.bind(null, slug);
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(
    boundAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Fiscal period *</label>
          <input
            name="fiscalPeriod"
            placeholder="e.g. FY2026Q3 or CY2025Q4"
            required
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Reported date *</label>
          <input
            type="date"
            name="reportedAt"
            required
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Source URL (optional)</label>
        <input
          type="url"
          name="sourceUrl"
          placeholder="https://investor.example.com/quarterly-results/..."
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Transcript or press release *
        </label>
        <p className="text-xs text-zinc-500 mb-2">
          Paste the full earnings call transcript (with Q&A if available) or the press release text. Claude will read it.
        </p>
        <textarea
          name="transcriptText"
          required
          rows={20}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm font-mono"
        />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
          Consensus estimates (optional, for beat/miss assessment)
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <input
            name="consensusRevenue"
            placeholder="Revenue cons. e.g. $55.0B"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="consensusEps"
            placeholder="EPS cons. e.g. $1.20"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="consensusNextQ"
            placeholder="Next-Q rev cons. e.g. $63B"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </details>

      {state.error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Analyzing… (30-60s)" : "Save & analyze"}
        </button>
        {pending && (
          <span className="text-sm text-zinc-500">
            Claude is reading the transcript. Don&apos;t close the tab.
          </span>
        )}
      </div>
    </form>
  );
}
