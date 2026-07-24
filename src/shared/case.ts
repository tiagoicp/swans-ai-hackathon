/**
 * Shared types for the Case Documents feature — the contract between the
 * Worker's `/api/process` route and the browser.
 *
 * Like the rest of `src/shared`, this file stays free of runtime dependencies:
 * types and plain values only. The zod schema that mirrors `CaseEvent` lives
 * server-side (phase 4), so it never reaches the client bundle.
 */

/**
 * One fact extracted from a case document — a medical visit, a bill line, a
 * diagnosis. Populated by the structured-extraction step in phase 4.
 */
export interface CaseEvent {
  /** ISO date `YYYY-MM-DD`, or the literal `"unknown"` when not legible. */
  date: string;
  description: string;
  provider: string;
  /** Amount in dollars, or `null` when the event carries no cost. */
  cost: number | null;
  /** Filename the event was extracted from. */
  source_file: string;
  /** 1-based page, or `null` when the page is unknown. */
  source_page: number | null;
  confidence: "high" | "low";
}

/**
 * What `POST /api/process` returns for one successfully processed file.
 *
 * Phase 2 returns just the echoed `filename`/`size`; phases 3–4 add `rawText`
 * and `events` as those steps land, without otherwise changing the contract.
 */
export interface ProcessResponse {
  filename: string;
  size: number;
}

/** Error envelope returned by `/api/process` for a rejected or failed file. */
export interface ProcessErrorResponse {
  error: string;
}
