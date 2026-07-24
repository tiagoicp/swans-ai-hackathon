import { Badge, Button, Loader, Text } from "@cloudflare/kumo";
import {
  FilePdfIcon,
  FileTextIcon,
  type Icon,
  ImageIcon,
  WarningCircleIcon,
  XIcon
} from "@phosphor-icons/react";
import type { CaseDocument, DocStatus } from "@client/lib/use-case-documents";

/** Type glyph from the MIME type, falling back to the filename extension. */
function iconFor(file: File): Icon {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return FilePdfIcon;
  }
  if (file.type.startsWith("image/") || /\.(png|jpe?g)$/.test(name)) {
    return ImageIcon;
  }
  return FileTextIcon;
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
            className="flex items-center gap-3 rounded-xl bg-kumo-base p-3 ring ring-kumo-line"
          >
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
          </li>
        );
      })}
    </ul>
  );
}
