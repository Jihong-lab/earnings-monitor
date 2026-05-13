"use client";

import { useActionState } from "react";
import { submitEarningsAnalysis, type SubmitState } from "./actions";

const INPUT =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

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
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Fiscal period *
          </label>
          <input
            name="fiscalPeriod"
            placeholder="e.g. FY2026Q3 or CY2025Q4"
            required
            className={INPUT}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Reported date *
          </label>
          <input type="date" name="reportedAt" required className={INPUT} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Source URL (optional)
        </label>
        <input
          type="url"
          name="sourceUrl"
          placeholder="https://investor.example.com/quarterly-results/..."
          className={INPUT}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Transcript or press release *
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Paste the full earnings call transcript (with Q&A if available) or the press
          release text. Claude will read it.
        </p>
        <textarea
          name="transcriptText"
          required
          rows={20}
          className={`${INPUT} font-mono`}
        />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
          Consensus estimates (optional, for beat/miss assessment)
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <input
            name="consensusRevenue"
            placeholder="Revenue cons. e.g. $55.0B"
            className={INPUT}
          />
          <input
            name="consensusEps"
            placeholder="EPS cons. e.g. $1.20"
            className={INPUT}
          />
          <input
            name="consensusNextQ"
            placeholder="Next-Q rev cons. e.g. $63B"
            className={INPUT}
          />
        </div>
      </details>

      {state.error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Analyzing… (30-60s)" : "Save & analyze"}
        </button>
        {pending && (
          <span className="text-sm text-gray-500">
            Claude is reading the transcript. Don&apos;t close the tab.
          </span>
        )}
      </div>
    </form>
  );
}
