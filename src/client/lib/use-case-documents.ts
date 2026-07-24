import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** Stable client id; also the React key and the row → source link. */
  id: string;
  /** Kept for re-processing and the "open original" link in the table. */
  file: File;
  /** Object URL for opening the original file; revoked on remove/unmount. */
  url: string;
  status: DocStatus;
  /** Human-readable failure reason when `status === "error"`. */
  error?: string;
  /** Extracted text (phase 3). */
  rawText?: string;
}

/** The editable fields a reviewer can change on a row. */
export type EventPatch = Partial<
  Pick<CaseEvent, "date" | "description" | "provider" | "cost">
>;

/**
 * One extracted event as it appears in the review table: the AI's `CaseEvent`
 * plus the reviewer-facing state layered on top of it.
 */
export interface EventRow extends CaseEvent {
  /** Stable client id; the React key and the handle for edit/delete/confirm. */
  id: string;
  /** The source document this event came from (for the "open original" link). */
  docId: string;
  /** A reviewer has changed one of the fields. */
  edited: boolean;
  /** A reviewer has explicitly accepted the row. */
  confirmed: boolean;
}

/** What `useCaseDocuments` hands back to the page. */
export interface UseCaseDocuments {
  documents: CaseDocument[];
  /** Every extracted event, merged across documents and sorted by date. */
  eventRows: EventRow[];
  /** Messages for files rejected before they entered the list. */
  rejections: string[];
  /** Validate, accept and start processing every file in the list. */
  addFiles: (files: FileList) => void;
  removeDocument: (id: string) => void;
  /** Clear the rejection notice. */
  dismissRejections: () => void;
  /** Apply a reviewer's edit to a row and flag it as edited. */
  updateEvent: (id: string, patch: EventPatch) => void;
  removeEvent: (id: string) => void;
  /** Accept a single (usually low-confidence) row. */
  confirmEvent: (id: string) => void;
  /** Accept every remaining row — the end of the review flow. */
  approveAll: () => void;
}

/** MIME types we can process. */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "application/vnd.ms-excel.sheet.macroenabled.12", // .xlsm
  "application/vnd.ms-excel.sheet.binary.macroenabled.12", // .xlsb
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/csv"
]);

/** Extension fallback for browsers that send an empty or wrong `file.type`. */
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".xlsx",
  ".xls",
  ".xlsm",
  ".xlsb",
  ".docx",
  ".csv"
];

function isAllowed(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** A one-line reason the file can't be accepted, or `null` when it's fine. */
function rejectionReason(file: File): string | null {
  if (!isAllowed(file)) return `${file.name}: unsupported file type`;
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
 * The single source of truth for the Case Documents workspace: the uploaded
 * documents, the events extracted from them and the actions that mutate both.
 * All state lives here and is passed down as props — no context, no store.
 *
 * On `addFiles`, each valid file is POSTed to `/api/process` individually so it
 * gets its own status and one bad file fails alone. Status walks
 * `uploaded → processing → done | error`; a done document's events land in
 * `eventRows`, where they become editable, confirmable review rows.
 */
export function useCaseDocuments(): UseCaseDocuments {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [rejections, setRejections] = useState<string[]>([]);

  // Latest documents, readable from async callbacks and the unmount cleanup.
  const documentsRef = useRef(documents);
  documentsRef.current = documents;

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
        // The document may have been removed while this request was in flight;
        // if so, drop the result instead of resurrecting rows for a document
        // that's already gone from the list.
        if (!documentsRef.current.some((d) => d.id === doc.id)) return;
        // Text extraction succeeded either way; a set `extractionError` means the
        // structured step failed, so the row shows an error but keeps its text.
        patchDocument(doc.id, {
          status: data.extractionError ? "error" : "done",
          error: data.extractionError,
          rawText: data.rawText
        });
        if (data.events.length > 0) {
          setRows((prev) => [...prev, ...data.events.map(toRow(doc.id))]);
        }
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
        accepted.push({
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          status: "uploaded"
        });
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
    setDocuments((prev) => {
      const doc = prev.find((d) => d.id === id);
      if (doc) URL.revokeObjectURL(doc.url);
      return prev.filter((d) => d.id !== id);
    });
    // Drop the document's events with it.
    setRows((prev) => prev.filter((row) => row.docId !== id));
  }, []);

  const dismissRejections = useCallback(() => setRejections([]), []);

  const updateEvent = useCallback((id: string, patch: EventPatch) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, ...patch, edited: true } : row
      )
    );
  }, []);

  const removeEvent = useCallback((id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const confirmEvent = useCallback((id: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, confirmed: true } : row))
    );
  }, []);

  const approveAll = useCallback(() => {
    setRows((prev) => prev.map((row) => ({ ...row, confirmed: true })));
  }, []);

  // Revoke every object URL when the workspace unmounts (e.g. route change).
  useEffect(
    () => () => {
      for (const doc of documentsRef.current) URL.revokeObjectURL(doc.url);
    },
    []
  );

  // One timeline across all documents, sorted by date with "unknown" last.
  const eventRows = useMemo(() => [...rows].sort(byDateAscending), [rows]);

  return {
    documents,
    eventRows,
    rejections,
    addFiles,
    removeDocument,
    dismissRejections,
    updateEvent,
    removeEvent,
    confirmEvent,
    approveAll
  };
}

/** Turn a freshly extracted event into an un-reviewed row for `docId`. */
function toRow(docId: string) {
  return (event: CaseEvent): EventRow => ({
    ...event,
    id: crypto.randomUUID(),
    docId,
    edited: false,
    confirmed: false
  });
}

/** Sort by ISO date ascending; the literal `"unknown"` always sorts last. */
function byDateAscending(a: CaseEvent, b: CaseEvent): number {
  if (a.date === b.date) return 0;
  if (a.date === "unknown") return 1;
  if (b.date === "unknown") return -1;
  return a.date < b.date ? -1 : 1;
}
