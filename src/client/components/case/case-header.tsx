import { LayerCard, Text } from "@cloudflare/kumo";
import { ScalesIcon } from "@phosphor-icons/react";

/**
 * The case this workspace is scoped to. Hardcoded for the demo — there is no
 * case picker or database, so the whole feature works one case at a time.
 */
const CASE = {
  reference: "Case #2024-183",
  client: "Maria Santos",
  matter: "Car accident"
} as const;

interface CaseHeaderProps {
  /** Documents uploaded so far. Drives the count in the metadata line. */
  documentCount: number;
}

/** Banner naming the case, its client, matter type and document count. */
export function CaseHeader({ documentCount }: CaseHeaderProps) {
  const documentLabel =
    documentCount === 1 ? "1 document" : `${documentCount} documents`;

  return (
    <LayerCard className="flex items-start gap-4 rounded-2xl p-6 ring ring-kumo-line">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-kumo-control text-kumo-brand">
        <ScalesIcon size={22} weight="duotone" />
      </span>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-kumo-default">
          {CASE.reference} — {CASE.client}
        </h1>
        <div className="mt-1">
          <Text size="sm" variant="secondary">
            {CASE.matter} · {documentLabel}
          </Text>
        </div>
      </div>
    </LayerCard>
  );
}
