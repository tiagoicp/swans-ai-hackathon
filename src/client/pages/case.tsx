import { Badge, LayerCard, Text } from "@cloudflare/kumo";
import { BriefcaseIcon, FilesIcon } from "@phosphor-icons/react";
import { AppHeader } from "@client/components/app-header";
import { CaseHeader } from "@client/components/case/case-header";

const COLUMN = "max-w-3xl";

/**
 * The Case Documents workspace: upload medical records and bills, let Gemini
 * transcribe and extract the events, then review them in a table.
 *
 * Phase 1 is the scaffold — header and layout only. Upload, extraction and the
 * review table land in later phases; `documentCount` is 0 until then.
 */
export default function CasePage() {
  const documentCount = 0;

  return (
    <div className="min-h-screen bg-kumo-elevated">
      <AppHeader
        contentClassName={COLUMN}
        badge={
          <Badge variant="secondary">
            <BriefcaseIcon size={12} weight="bold" className="mr-1" />
            Case workspace
          </Badge>
        }
      />
      <main className={`${COLUMN} mx-auto space-y-6 px-5 py-8`}>
        <CaseHeader documentCount={documentCount} />

        <LayerCard className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-kumo-line p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-kumo-control text-kumo-brand">
            <FilesIcon size={22} weight="duotone" />
          </span>
          <Text bold as="span">
            Document upload coming next
          </Text>
          <Text size="sm" variant="secondary">
            Drag in medical records and bills to have every event, date and cost
            extracted into a review table.
          </Text>
        </LayerCard>
      </main>
    </div>
  );
}
