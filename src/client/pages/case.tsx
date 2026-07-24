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
 * Phase 2 adds upload — drop zone, file list and per-file processing against a
 * stub `/api/process`. Text extraction and the review table land in phases 3–5.
 */
export default function CasePage() {
  const { documents, rejections, addFiles, removeDocument, dismissRejections } =
    useCaseDocuments();

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
