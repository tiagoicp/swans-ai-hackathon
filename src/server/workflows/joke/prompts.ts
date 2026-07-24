/**
 * Prompts for the joke workflow.
 *
 * Both steps ask for plain text rather than structured output. The provider does
 * advertise `response_format: json_schema`, but whether a given Workers AI model
 * honors it varies — and a model that ignores it turns every step into a retry
 * storm. A newline-delimited list parses just as reliably and cannot fail that
 * way. See `parseAngles` in workflow.ts.
 */

/** Asks for `count` distinct comedic angles, one per line. */
export function buildAnglesPrompt(count: number): string {
  return `Give me ${count} different comedic angles for jokes about swans.

An "angle" is a short subject to build a joke around — for example "swans being territorial" or "a swan applying for a job".

Rules:
- Exactly ${count} angles.
- One per line. No numbering, no bullets, no blank lines.
- Each angle under 10 words.
- Make them genuinely different from each other.
- Reply with the list and nothing else.`;
}

/** Asks for a single joke on one angle. */
export function buildJokePrompt(angle: string): string {
  return `Write one short, genuinely funny joke about swans, on this angle: ${angle}

Rules:
- Two or three sentences at most.
- Self-contained — it has to land without any setup from me.
- Reply with the joke and nothing else. No preamble, no quotation marks, no explanation.`;
}
