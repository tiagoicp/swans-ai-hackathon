import {
  type CaseEvent,
  classifyDocument,
  type DocumentKind,
  MAX_UPLOAD_BYTES,
  type ProcessErrorResponse,
  type ProcessResponse
} from "@shared";
import { imageToText, pdfToText } from "../lib/ai";
import { extractEvents } from "../lib/extract-events";

/**
 * Vision-path ceiling, stricter than `MAX_UPLOAD_BYTES`. `imageToText`
 * materializes the image as a plain JS number array (~4 bytes per element in
 * V8), so a near-20 MB image would push the isolate past its fixed 128 MB
 * memory limit — a termination that bypasses `try/catch`. Reject before
 * allocating instead.
 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * `POST /api/process` — extract the text from a single uploaded document.
 *
 * The client posts one file per request (multipart, field `file`) so each
 * upload carries its own status and the 20 MB limit applies per call. This runs
 * the phase 3 text step — `toMarkdown()` for PDFs, the vision model for images,
 * `file.text()` for plain text — then extracts structured `events` from that
 * text and returns `{ filename, rawText, events }`. A text-extraction failure
 * comes back as a 4xx/5xx error envelope; a structured-extraction failure keeps
 * the 200 (the text is still useful) but carries an `extractionError` in place
 * of events. Either way the request never throws.
 */
export async function handleProcess(
  request: Request,
  env: Env
): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Expected a multipart file upload.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse("No file was provided.", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return errorResponse("File is larger than 20 MB.", 413);
  }

  const kind = classifyDocument(file);
  if (kind === "image" && file.size > MAX_IMAGE_BYTES) {
    return errorResponse("Image is larger than 8 MB.", 413);
  }

  let rawText: string;
  try {
    rawText = await extractText(env, file, kind);
  } catch (error) {
    // Surface the binding's message but keep the request alive.
    const message =
      error instanceof Error ? error.message : "Text extraction failed.";
    return errorResponse(message, 502);
  }

  // A pure image-scan PDF (or a blank file) yields no embedded text; say so
  // rather than returning an empty preview.
  if (rawText.trim().length === 0) {
    return errorResponse("No readable text found in this document.", 422);
  }

  // Text is in hand; derive the structured events. A failure here is soft — we
  // still return the text so it can be reviewed, flagged with `extractionError`.
  let events: CaseEvent[];
  try {
    events = await extractEvents(env, rawText, file.name);
  } catch {
    const failure: ProcessResponse = {
      filename: file.name,
      rawText,
      events: [],
      extractionError: "Could not extract structured events from this document."
    };
    return Response.json(failure);
  }

  const payload: ProcessResponse = { filename: file.name, rawText, events };
  return Response.json(payload);
}

/** Route a file to the extractor for its kind. */
function extractText(
  env: Env,
  file: File,
  kind: DocumentKind
): Promise<string> {
  switch (kind) {
    case "pdf":
      return pdfToText(env, file);
    case "image":
      return imageToText(env, file);
    case "text":
      return file.text();
  }
}

/** JSON error body with a matching HTTP status. */
function errorResponse(message: string, status: number): Response {
  const body: ProcessErrorResponse = { error: message };
  return Response.json(body, { status });
}
