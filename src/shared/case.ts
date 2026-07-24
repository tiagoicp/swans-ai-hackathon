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

/**
 * The three extraction paths `/api/process` knows how to route. `"document"`
 * is anything `env.AI.toMarkdown()` converts — PDF, Excel/Office spreadsheets,
 * Word and CSV — not just PDF.
 */
export type DocumentKind = "document" | "image" | "text";

/** Extensions routed through the Markdown Conversion binding (`toMarkdown`). */
const DOC_EXTENSIONS = /\.(pdf|xlsx|xlsm|xlsb|xls|docx|csv|ods|odt)$/;

/** MIME types routed through `toMarkdown`; extensions cover the rest. */
const DOC_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "application/vnd.ms-excel.sheet.macroenabled.12", // .xlsm
  "application/vnd.ms-excel.sheet.binary.macroenabled.12", // .xlsb
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/csv"
]);

/**
 * Classify an upload by MIME type, falling back to its filename extension.
 * The one source of truth for which file types the feature supports — the
 * server routes extractors off it and the client picks type icons off it.
 *
 * The extension fallback is first-class: browsers frequently send an empty or
 * wrong `type` for Office files, so the name is checked alongside the MIME.
 */
export function classifyDocument(file: {
  name: string;
  type: string;
}): DocumentKind {
  const name = file.name.toLowerCase();
  if (DOC_TYPES.has(file.type) || DOC_EXTENSIONS.test(name)) return "document";
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
 * Text extraction is the gate: if it fails the route returns a
 * `ProcessErrorResponse` instead. Once there's text, the response always
 * carries it — `events` holds the structured facts derived from `rawText`, and
 * `extractionError` is set (with `events` empty) when the structured step
 * failed after its retry but the text is still worth showing.
 */
export interface ProcessResponse {
  filename: string;
  /** Full text extracted from the document. */
  rawText: string;
  /** Structured facts derived from `rawText`; empty when extraction failed. */
  events: CaseEvent[];
  /**
   * Set when text extraction succeeded but structured extraction failed after a
   * retry. `rawText` is still returned so the source can be reviewed by hand.
   */
  extractionError?: string;
}

/** Error envelope returned by `/api/process` for a rejected or failed file. */
export interface ProcessErrorResponse {
  error: string;
}
