/**
 * Shared types for the Case Documents feature — the contract between the
 * Worker's `/api/process` route and the browser.
 *
 * Like the rest of `src/shared`, this file stays free of runtime dependencies:
 * types, plain values and pure helpers only. The zod schema that mirrors
 * `CaseEvent` lives server-side (phase 4), so it never reaches the client
 * bundle.
 */

/** Per-file upload ceiling, enforced on both client and server. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** The three extraction paths `/api/process` knows how to route. */
export type DocumentKind = "pdf" | "image" | "text";

/**
 * Classify an upload by MIME type, falling back to its filename extension.
 * The one source of truth for which file types the feature supports — the
 * server routes extractors off it and the client picks type icons off it.
 */
export function classifyDocument(file: {
  name: string;
  type: string;
}): DocumentKind {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("image/") || /\.(png|jpe?g)$/.test(name)) {
    return "image";
  }
  return "text";
}

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
 * Phase 3 returns the extracted `rawText`; phase 4 adds the structured `events`
 * derived from it, without otherwise changing the contract.
 */
export interface ProcessResponse {
  filename: string;
  /** Full text extracted from the document. */
  rawText: string;
}

/** Error envelope returned by `/api/process` for a rejected or failed file. */
export interface ProcessErrorResponse {
  error: string;
}
