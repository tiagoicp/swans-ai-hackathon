import { useCallback, useMemo, useState } from "react";
import {
  type CaseEvent,
  MAX_UPLOAD_BYTES,
  type ProcessErrorResponse,
  type ProcessResponse
} from "@shared";

/** Where a document sits in the upload → extraction pipeline. */
export type DocStatus = "uploaded" | "processing" | "done" | "error";

/** One uploaded document and everything we've derived from it. */
export interface CaseDocument {
  /** Stable client id; also the React key. */
  id: string;
  /** Kept for re-processing and "open original" links in later phases. */
  file: File;
  status: DocStatus;
  /** Human-readable failure reason when `status === "error"`. */
  error?: string;
  /** Extracted text (phase 3). */
  rawText?: string;
  /** Structured events (phase 4). */
  events?: CaseEvent[];
}

/** What `useCaseDocuments` hands back to the page. */
export interface UseCaseDocuments {
  documents: CaseDocument[];
  /** Every processed document's events, merged and sorted by date ascending. */
  allEvents: CaseEvent[];
  /** Messages for files rejected before they entered the list. */
  rejections: string[];
  /** Validate, accept and start processing every file in the list. */
  addFiles: (files: FileList) => void;
  removeDocument: (id: string) => void;
  /** Clear the rejection notice. */
  dismissRejections: () => void;
}

/** MIME types we can process. */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg"
]);

/** Extension fallback for browsers that send an empty `file.type`. */
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".png", ".jpg", ".jpeg"];

function isAllowed(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** A one-line reason the file can't be accepted, or `null` when it's fine. */
function rejectionReason(file: File): string | null {
  if (!isAllowed(file)) return `${file.name}: only PDF, TXT, PNG or JPG`;
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name}: larger than 20 MB`;
  return null;
}

/** Pulls a readable message out of a failed `/api/process` response. */
async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as Partial<ProcessErrorResponse>;
    if (typeof data.error === "string") return data.error;
  } catch {
    // Non-JSON body — fall through to the generic message.
  }
  return `Upload failed (${response.status}).`;
}

/**
 * The single source of truth for the Case Documents workspace: the list of
 * uploaded documents plus the actions that mutate it. All state lives here and
 * is passed down as props — no context, no store.
 *
 * On `addFiles`, each valid file is POSTed to `/api/process` individually so it
 * gets its own status and one bad file fails alone. Status walks
 * `uploaded → processing → done | error`.
 */
export function useCaseDocuments(): UseCaseDocuments {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [rejections, setRejections] = useState<string[]>([]);

  const patchDocument = useCallback(
    (id: string, patch: Partial<CaseDocument>) => {
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc))
      );
    },
    []
  );

  const processDocument = useCallback(
    async (doc: CaseDocument) => {
      patchDocument(doc.id, { status: "processing", error: undefined });
      try {
        const body = new FormData();
        body.append("file", doc.file);
        const response = await fetch("/api/process", { method: "POST", body });
        if (!response.ok) {
          patchDocument(doc.id, {
            status: "error",
            error: await readError(response)
          });
          return;
        }
        const data = (await response.json()) as ProcessResponse;
        // Text extraction succeeded either way; a set `extractionError` means the
        // structured step failed, so the row shows an error but keeps its text.
        patchDocument(doc.id, {
          status: data.extractionError ? "error" : "done",
          error: data.extractionError,
          rawText: data.rawText,
          events: data.events
        });
      } catch (error) {
        patchDocument(doc.id, {
          status: "error",
          error:
            error instanceof Error ? error.message : "Something went wrong."
        });
      }
    },
    [patchDocument]
  );

  const addFiles = useCallback(
    (fileList: FileList) => {
      const accepted: CaseDocument[] = [];
      const errors: string[] = [];
      for (const file of Array.from(fileList)) {
        const reason = rejectionReason(file);
        if (reason) {
          errors.push(reason);
          continue;
        }
        accepted.push({ id: crypto.randomUUID(), file, status: "uploaded" });
      }
      if (errors.length > 0) setRejections((prev) => [...prev, ...errors]);
      if (accepted.length > 0) {
        setDocuments((prev) => [...prev, ...accepted]);
        for (const doc of accepted) void processDocument(doc);
      }
    },
    [processDocument]
  );

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  const dismissRejections = useCallback(() => setRejections([]), []);

  // Merge every done document's events into one timeline, sorted by date with
  // "unknown" dates sinking to the bottom.
  const allEvents = useMemo(
    () =>
      documents
        .filter((doc) => doc.status === "done")
        .flatMap((doc) => doc.events ?? [])
        .sort(byDateAscending),
    [documents]
  );

  return {
    documents,
    allEvents,
    rejections,
    addFiles,
    removeDocument,
    dismissRejections
  };
}

/** Sort by ISO date ascending; the literal `"unknown"` always sorts last. */
function byDateAscending(a: CaseEvent, b: CaseEvent): number {
  if (a.date === b.date) return 0;
  if (a.date === "unknown") return 1;
  if (b.date === "unknown") return -1;
  return a.date < b.date ? -1 : 1;
}
