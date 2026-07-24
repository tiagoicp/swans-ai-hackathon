/**
 * The Direct Actions catalog.
 *
 * Direct Actions are the non-conversational half of Swans AI: one click, one
 * result, no chat history. Each entry's `type` is the value carried in the URL
 * (`/action?type=joke`), so this module is the single source of truth for the
 * homepage grid, the action page, and — once the Workflow backend lands — the
 * server-side validation of that query param.
 *
 * Like the rest of `src/shared`, this stays free of runtime dependencies.
 */

/** Whether an action can be run today, or is only advertised on the roadmap. */
export type ActionStatus = "live" | "soon";

/** A numeric input an action collects before it runs. */
export interface ActionCountInput {
  label: string;
  description: string;
  min: number;
  max: number;
  defaultValue: number;
}

export interface ActionDefinition {
  /** URL value: `/action?type=<type>`. */
  type: string;
  title: string;
  /** One-liner shown on the card and above the runner. */
  description: string;
  status: ActionStatus;
  /** Present only for actions that take a number before running. */
  countInput?: ActionCountInput;
  /**
   * A dedicated page for actions too rich for the generic `?type=` runner.
   * When set, the card links here instead of `/action?type=<type>`.
   */
  href?: string;
}

export const ACTIONS: readonly ActionDefinition[] = [
  {
    type: "joke",
    title: "Tell me a joke",
    description:
      "Pick how many jokes you want and Lexi's workflow writes them, one step at a time.",
    status: "live",
    countInput: {
      label: "How many jokes?",
      description: "Between 1 and 10.",
      min: 1,
      max: 10,
      defaultValue: 3
    }
  },
  {
    type: "case-documents",
    title: "Process case documents",
    description:
      "Upload medical records and bills for a case; AI extracts every event, date and cost into a review table.",
    status: "live",
    href: "/case"
  },
  {
    type: "summarize",
    title: "Summarize a document",
    description:
      "Drop in a long document and get the three things that actually matter.",
    status: "soon"
  },
  {
    type: "translate",
    title: "Translate text",
    description:
      "Move a message between languages without losing its tone of voice.",
    status: "soon"
  },
  {
    type: "digest",
    title: "Daily digest",
    description:
      "A short briefing of everything that changed since you last looked.",
    status: "soon"
  }
];

/** Resolves a raw `?type=` query value to its catalog entry, if any. */
export function findAction(
  type: string | null | undefined
): ActionDefinition | undefined {
  if (!type) return undefined;
  return ACTIONS.find((action) => action.type === type);
}
