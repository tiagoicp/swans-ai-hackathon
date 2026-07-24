/**
 * Thin helpers around the Workers AI binding (`env.AI`) for the Case Documents
 * feature. Model ids live here as constants so swapping a model is a one-line
 * change. No SDK, no HTTP client, no key handling — the binding does it all,
 * and `remote: true` in wrangler.jsonc means local dev hits real inference.
 */

/**
 * Vision model used to transcribe scanned documents (PNG/JPG). The only vision
 * model on the Workers AI JSON Mode support list, so this one id also leaves
 * the door open to reading images straight into events later.
 */
export const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

/** Instruction for the vision transcription step. */
const TRANSCRIBE_PROMPT =
  "Transcribe the full text content of this document image. " +
  "Preserve reading order. Output plain text only.";

/**
 * Vision models default to a small token ceiling; a full-page medical bill
 * needs room, so lift it well above the expected transcription length to avoid
 * truncating the output.
 */
const TRANSCRIBE_MAX_TOKENS = 4096;

/**
 * PDF → text via the Markdown Conversion binding. Extracts *embedded* text (a
 * pure image-scan PDF can come back near-empty — the caller surfaces that as a
 * "no text found" error). Markdown output preserves table structure in bills.
 */
export async function pdfToText(env: Env, file: File): Promise<string> {
  const result = await env.AI.toMarkdown({ name: file.name, blob: file });
  if (result.format === "error") {
    throw new Error(`PDF conversion failed: ${result.error}`);
  }
  return result.data;
}

/**
 * Image (PNG/JPG) → text via the vision model. The image bytes go to the
 * binding as a byte array and the model transcribes them in reading order.
 */
export async function imageToText(env: Env, file: File): Promise<string> {
  const bytes = [...new Uint8Array(await file.arrayBuffer())];
  const result = await env.AI.run(VISION_MODEL, {
    prompt: TRANSCRIBE_PROMPT,
    image: bytes,
    max_tokens: TRANSCRIBE_MAX_TOKENS
  });
  return result.response ?? "";
}
