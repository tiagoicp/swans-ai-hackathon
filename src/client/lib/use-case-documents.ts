import { useCallback, useState } from "react";
import type { CaseEvent, ProcessErrorResponse } from "@shared";

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
  /** Messages for files rejected before they entered the list. */
  rejections: string[];
  /** Validate, accept and start processing every file in the list. */
  addFiles: (files: FileList) => void;
  removeDocument: (id: string) => void;
  /** Clear the rejection notice. */
  dismissRejections: () => void;
}

/** Upload ceiling. Mirrored server-side in `handleProcess`. */
const MAX_BYTES = 20 * 1024 * 1024;

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
  if (file.size > MAX_BYTES) return `${file.name}: larger than 20 MB`;
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
        // Phase 2 stub echoes `{ filename, size }` — nothing to store yet.
        // Phases 3–4 will read `rawText`/`events` off this response.
        await response.json();
        patchDocument(doc.id, { status: "done" });
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

  return {
    documents,
    rejections,
    addFiles,
    removeDocument,
    dismissRejections
  };
}
