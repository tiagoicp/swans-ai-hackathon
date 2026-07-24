/**
 * Structured extraction: turn a document's raw text into `CaseEvent`s using
 * Workers AI JSON Mode. One zod schema is the single source of truth — it both
 * generates the `json_schema` the model is constrained to (via zod v4's
 * `z.toJSONSchema`) and validates whatever comes back. Invalid output gets one
 * corrective retry before the caller gives up on that file.
 *
 * This module is server-only (it imports `zod`), so it never reaches the client
 * bundle — matching the `src/shared` no-runtime-deps rule.
 */

import { z } from "zod";
import type { CaseEvent } from "@shared";
import { EXTRACTION_MODEL } from "./ai";

/** zod mirror of `CaseEvent` — kept in lockstep by the `satisfies` below. */
const caseEventSchema = z.object({
  date: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.literal("unknown")
  ]),
  description: z.string(),
  provider: z.string(),
  cost: z.number().nullable(),
  source_file: z.string(),
  source_page: z.number().int().nullable(),
  confidence: z.enum(["high", "low"])
}) satisfies z.ZodType<CaseEvent>;

/** The model returns the events wrapped in an object — JSON Mode needs a root object. */
const extractionSchema = z.object({ events: z.array(caseEventSchema) });

/** Standard JSON Schema handed to the model as `response_format.json_schema`. */
const EXTRACTION_JSON_SCHEMA = z.toJSONSchema(extractionSchema);

/**
 * A long medical record can produce more markdown than the model's context
 * holds. Cap the input defensively so a huge document degrades to a partial
 * extraction instead of a hard context-overflow error mid-demo.
 */
const MAX_INPUT_CHARS = 24_000;

/** Headroom for the events array of a dense, multi-page bill. */
const EXTRACTION_MAX_TOKENS = 4096;

const SYSTEM_PROMPT = [
  "You are a meticulous legal case assistant. Read the document text and extract",
  "every medical or case event — visits, procedures, diagnoses, bill line items —",
  "into JSON matching the provided schema.",
  "",
  "Only extract facts explicitly present in the document. If a value is uncertain",
  "or partially legible, set confidence to 'low'. Never guess dates or amounts.",
  "",
  "Rules:",
  "- Use the exact filename given below as `source_file` on every event.",
  "- Set `source_page` only when the page is stated in the text, otherwise null.",
  '- `date` is `YYYY-MM-DD`, or the literal "unknown" when no date is legible.',
  "- `cost` is a dollar amount as a plain number, or null when there is no cost.",
  '- Return an object shaped { "events": [...] } and nothing else.'
].join("\n");

type Message = { role: "system" | "user" | "assistant"; content: string };

/**
 * Extract structured events from a document's raw text.
 *
 * Passing the already-extracted text (not the original binary) keeps the call
 * cheap and debuggable. On invalid output — including the platform's own
 * `JSON Mode couldn't be met` error — the model gets one retry with its bad
 * response and the exact schema issues. Still invalid → throws, matching the
 * plain-`Error` convention of the phase 3 helpers in `ai.ts`.
 */
export async function extractEvents(
  env: Env,
  rawText: string,
  filename: string
): Promise<CaseEvent[]> {
  const baseMessages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Filename: ${filename}\n\nDocument text:\n${truncate(rawText)}`
    }
  ];

  const first = await attempt(env, baseMessages);
  if (first.ok) return first.events;

  // One corrective retry: show the model its output and the precise schema issues.
  const retry = await attempt(env, [
    ...baseMessages,
    { role: "assistant", content: first.raw },
    {
      role: "user",
      content:
        `Your previous response was invalid JSON for the schema: ${first.issues}. ` +
        "Return a corrected response."
    }
  ]);
  if (retry.ok) return retry.events;

  throw new Error("Structured extraction failed after retry.");
}

type Attempt =
  | { ok: true; events: CaseEvent[] }
  | { ok: false; raw: string; issues: string };

/** Run the model once and validate the result against the schema. */
async function attempt(env: Env, messages: Message[]): Promise<Attempt> {
  let candidate: unknown;
  let raw: string;
  try {
    ({ candidate, raw } = await runExtraction(env, messages));
  } catch (error) {
    // Platform-level failures (e.g. "JSON Mode couldn't be met") are retryable.
    const issues = error instanceof Error ? error.message : String(error);
    return { ok: false, raw: "", issues };
  }

  const result = extractionSchema.safeParse(candidate);
  if (!result.success) {
    return { ok: false, raw, issues: JSON.stringify(result.error.issues) };
  }
  return { ok: true, events: result.data.events };
}

/**
 * One JSON-Mode inference call. Returns the value to validate plus a text form
 * of it to echo back on retry. In JSON Mode the binding hands back `response`
 * as an already-parsed object; a plain-text response arrives as a JSON string.
 */
async function runExtraction(
  env: Env,
  messages: Message[]
): Promise<{ candidate: unknown; raw: string }> {
  const result = await env.AI.run(EXTRACTION_MODEL, {
    messages,
    response_format: {
      type: "json_schema",
      json_schema: EXTRACTION_JSON_SCHEMA
    },
    max_tokens: EXTRACTION_MAX_TOKENS
  });

  const value =
    result && typeof result === "object" && "response" in result
      ? (result as { response?: unknown }).response
      : result;

  if (typeof value === "string") {
    const raw = value;
    try {
      return { candidate: JSON.parse(raw), raw };
    } catch {
      return { candidate: undefined, raw };
    }
  }
  return { candidate: value, raw: JSON.stringify(value ?? null) };
}

/** Trim overly long input to the model's comfortable window. */
function truncate(text: string): string {
  return text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
}
