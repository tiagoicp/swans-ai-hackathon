import { useRef, useState } from "react";
import { Button, Text } from "@cloudflare/kumo";
import { UploadSimpleIcon } from "@phosphor-icons/react";

/** File types the picker advertises. Kept in sync with `useCaseDocuments`. */
const ACCEPT = ".pdf,.txt,.png,.jpg,.jpeg,.xlsx,.xls,.xlsm,.xlsb,.docx,.csv";

interface UploadZoneProps {
  /** Receives every dropped or selected file; the hook filters and processes. */
  onFiles: (files: FileList) => void;
}

/**
 * Drag-and-drop target with a "browse files" button over a hidden input.
 * Drag-and-drop is a progressive enhancement — keyboard users use the button.
 */
export function UploadZone({ onFiles }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (files && files.length > 0) onFiles(files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center transition-colors ${
        dragging
          ? "border-kumo-brand bg-kumo-control/40 ring ring-kumo-brand"
          : "border-kumo-line bg-kumo-base"
      }`}
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-kumo-control text-kumo-brand">
        <UploadSimpleIcon size={22} weight="duotone" />
      </span>
      <Text bold as="span">
        Drag medical records and bills here
      </Text>
      <Text size="sm" variant="secondary">
        PDF, Excel, Word, CSV, TXT, PNG or JPG · up to 20 MB each
      </Text>
      <Button
        type="button"
        variant="secondary"
        onClick={() => inputRef.current?.click()}
      >
        Browse files
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        aria-label="Upload case documents"
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          // Reset so re-selecting the same file fires `onChange` again.
          event.target.value = "";
        }}
      />
    </div>
  );
}
