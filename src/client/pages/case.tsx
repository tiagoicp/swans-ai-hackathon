import { Badge, Button, LayerCard, Text } from "@cloudflare/kumo";
import { BriefcaseIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { AppHeader } from "@client/components/app-header";
import { CaseHeader } from "@client/components/case/case-header";
import { UploadZone } from "@client/components/case/upload-zone";
import { FileList } from "@client/components/case/file-list";
import { useCaseDocuments } from "@client/lib/use-case-documents";

const COLUMN = "max-w-3xl";

/**
 * The Case Documents workspace: upload medical records and bills, let Workers
 * AI transcribe and extract the events, then review them in a table.
 *
 * Phase 2 adds upload — drop zone, file list and per-file processing. Phase 3
 * adds text extraction, phase 4 the structured events (shown raw below for now);
 * the review table replaces the raw dump in phase 5.
 */
export default function CasePage() {
  const {
    documents,
    allEvents,
    rejections,
    addFiles,
    removeDocument,
    dismissRejections
  } = useCaseDocuments();

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
        <CaseHeader documentCount={documents.length} />

        <div className="space-y-3">
          <UploadZone onFiles={addFiles} />
          {rejections.length > 0 && (
            <RejectionNotice
              messages={rejections}
              onDismiss={dismissRejections}
            />
          )}
        </div>

        {documents.length > 0 && (
          <FileList documents={documents} onRemove={removeDocument} />
        )}

        {allEvents.length > 0 && (
          <section className="space-y-2">
            <Text size="sm" variant="secondary" as="p">
              {allEvents.length} extracted{" "}
              {allEvents.length === 1 ? "event" : "events"} (raw — the review
              table lands in phase 5)
            </Text>
            <pre className="max-h-96 overflow-auto rounded-xl bg-kumo-control p-4 font-mono text-xs whitespace-pre-wrap text-kumo-default">
              {JSON.stringify(allEvents, null, 2)}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}

/** Dismissible inline list of files that never made it into the upload list. */
function RejectionNotice({
  messages,
  onDismiss
}: {
  messages: string[];
  onDismiss: () => void;
}) {
  return (
    <LayerCard className="flex items-start gap-3 rounded-xl p-4 ring ring-kumo-warning">
      <WarningCircleIcon
        size={18}
        className="mt-0.5 shrink-0 text-kumo-warning"
      />
      <ul className="min-w-0 flex-1 space-y-0.5">
        {messages.map((message, index) => (
          <li key={index}>
            <Text size="sm" as="span">
              {message}
            </Text>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        shape="square"
        size="sm"
        icon={<XIcon size={14} />}
        aria-label="Dismiss upload errors"
        onClick={onDismiss}
      />
    </LayerCard>
  );
}
