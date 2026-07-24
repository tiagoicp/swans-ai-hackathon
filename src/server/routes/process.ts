import type { ProcessErrorResponse, ProcessResponse } from "@shared";

/** Upload ceiling, mirrored on the client in `useCaseDocuments`. */
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * `POST /api/process` — process a single uploaded document.
 *
 * The client posts one file per request (multipart, field `file`) so each
 * upload carries its own status and the 20 MB limit applies per call. Phase 2
 * is a stub: it validates the upload and echoes `{ filename, size }`, which is
 * enough to prove `run_worker_first` routes `/api/*` to the Worker. Phases 3–4
 * replace the body with real text and event extraction (using `env.AI`)
 * without changing this request/response contract.
 */
export async function handleProcess(
  request: Request,
  _env: Env
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
  if (file.size > MAX_BYTES) {
    return errorResponse("File is larger than 20 MB.", 413);
  }

  const payload: ProcessResponse = { filename: file.name, size: file.size };
  return Response.json(payload);
}

/** JSON error body with a matching HTTP status. */
function errorResponse(message: string, status: number): Response {
  const body: ProcessErrorResponse = { error: message };
  return Response.json(body, { status });
}
