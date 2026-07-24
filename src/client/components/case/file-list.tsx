import { Badge, Button, Loader, Text } from "@cloudflare/kumo";
import {
  FileCsvIcon,
  FileDocIcon,
  FilePdfIcon,
  FileTextIcon,
  FileXlsIcon,
  type Icon,
  ImageIcon,
  WarningCircleIcon,
  XIcon
} from "@phosphor-icons/react";
import type { CaseDocument, DocStatus } from "@client/lib/use-case-documents";
import { classifyDocument } from "@shared";

/**
 * Type glyph for a document. Several formats share the `"document"` kind
 * (Excel, Word, CSV, PDF all convert via `toMarkdown`), so pick by extension
 * for a recognizable icon, then fall back to `classifyDocument` for the
 * image-vs-text split.
 */
function iconFor(file: File): Icon {
  const name = file.name.toLowerCase();
  if (/\.(xlsx|xlsm|xlsb|xls|ods)$/.test(name)) return FileXlsIcon;
  if (/\.(docx|odt)$/.test(name)) return FileDocIcon;
  if (name.endsWith(".csv")) return FileCsvIcon;
  if (name.endsWith(".pdf")) return FilePdfIcon;
  return classifyDocument(file) === "image" ? ImageIcon : FileTextIcon;
}

/** Bytes as a compact human string: "812 B", "18 KB", "2.4 MB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** The status pill: colour tone plus an inline spinner while processing. */
function StatusBadge({ status }: { status: DocStatus }) {
  switch (status) {
    case "uploaded":
      return <Badge variant="secondary">Uploaded</Badge>;
    case "processing":
      return (
        <Badge variant="secondary">
          <Loader size={12} className="mr-1" />
          Processing
        </Badge>
      );
    case "done":
      return <Badge variant="success">Done</Badge>;
    case "error":
      return <Badge variant="error">Error</Badge>;
  }
}

interface FileListProps {
  documents: CaseDocument[];
  onRemove: (id: string) => void;
}

/** The uploaded documents — one row each, with type, size, status and remove. */
export function FileList({ documents, onRemove }: FileListProps) {
  return (
    <ul className="space-y-2">
      {documents.map((doc) => {
        const TypeIcon = iconFor(doc.file);
        return (
          <li
            key={doc.id}
            className="rounded-xl bg-kumo-base ring ring-kumo-line"
          >
            <div className="flex items-center gap-3 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-kumo-control text-kumo-brand">
                <TypeIcon size={18} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-kumo-default">
                  {doc.file.name}
                </p>
                <Text size="xs" variant="secondary">
                  {formatSize(doc.file.size)}
                </Text>
                {doc.status === "error" && doc.error && (
                  <div className="mt-1 flex items-start gap-1 text-kumo-danger">
                    <WarningCircleIcon size={13} className="mt-0.5 shrink-0" />
                    <span className="text-xs">{doc.error}</span>
                  </div>
                )}
              </div>
              <StatusBadge status={doc.status} />
              <Button
                variant="ghost"
                shape="square"
                size="sm"
                icon={<XIcon size={15} />}
                aria-label={`Remove ${doc.file.name}`}
                onClick={() => onRemove(doc.id)}
              />
            </div>
            {doc.rawText && <RawTextPreview text={doc.rawText} />}
          </li>
        );
      })}
    </ul>
  );
}

/** Collapsible, scrollable view of the text extracted from a document. */
function RawTextPreview({ text }: { text: string }) {
  return (
    <details className="border-t border-kumo-line px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-kumo-secondary select-none">
        Raw text
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-kumo-control p-3 font-mono text-xs whitespace-pre-wrap text-kumo-default">
        {text}
      </pre>
    </details>
  );
}
