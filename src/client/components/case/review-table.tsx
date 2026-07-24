import { useMemo, useState } from "react";
import { Badge, Button, Input, Table, Text } from "@cloudflare/kumo";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CheckIcon,
  PencilSimpleIcon,
  TrashIcon,
  WarningIcon,
  XIcon
} from "@phosphor-icons/react";
import type {
  CaseDocument,
  EventPatch,
  EventRow
} from "@client/lib/use-case-documents";

/** `$1,250.00` formatter for the cost column. */
const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

/** A low-confidence row a reviewer hasn't edited or confirmed yet. */
function needsReview(row: EventRow): boolean {
  return row.confidence === "low" && !row.edited && !row.confirmed;
}

interface ReviewTableProps {
  rows: EventRow[];
  /** Source documents, for resolving a row's "open original" link by `docId`. */
  documents: CaseDocument[];
  onUpdate: (id: string, patch: EventPatch) => void;
  onRemove: (id: string) => void;
  onConfirm: (id: string) => void;
  onApproveAll: () => void;
}

/**
 * The reviewable timeline of every extracted event. Low-confidence rows are
 * flagged amber until a reviewer edits or confirms them; once nothing is left
 * to review the whole set can be approved in one click.
 */
export function ReviewTable({
  rows,
  documents,
  onUpdate,
  onRemove,
  onConfirm,
  onApproveAll
}: ReviewTableProps) {
  const toasts = useKumoToastManager();
  const urlByDoc = useMemo(
    () => new Map(documents.map((doc) => [doc.id, doc.url])),
    [documents]
  );

  const factCount = rows.length;
  const reviewCount = rows.filter(needsReview).length;

  function handleApproveAll() {
    onApproveAll();
    toasts.add({
      title: "All events approved",
      description: `${factCount} ${factCount === 1 ? "event" : "events"} marked as reviewed.`,
      variant: "success"
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text size="sm" variant="secondary" as="p">
          <span className="font-medium text-kumo-default">{factCount}</span>{" "}
          {factCount === 1 ? "fact" : "facts"} extracted
          {reviewCount > 0 && (
            <>
              {" · "}
              <span className="font-medium text-kumo-warning">
                {reviewCount}
              </span>{" "}
              need review
            </>
          )}
        </Text>
        <div className="flex items-center gap-2">
          {reviewCount > 0 && (
            <Text size="xs" variant="secondary">
              Resolve every flagged row to approve
            </Text>
          )}
          <Button
            variant="primary"
            disabled={reviewCount > 0}
            onClick={handleApproveAll}
          >
            Approve all reviewed
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl ring ring-kumo-line">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Date</Table.Head>
              <Table.Head>Event</Table.Head>
              <Table.Head>Provider</Table.Head>
              <Table.Head className="text-right">Cost</Table.Head>
              <Table.Head>Source</Table.Head>
              <Table.Head>Confidence</Table.Head>
              <Table.Head className="text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((row) => (
              <ReviewRow
                key={row.id}
                row={row}
                sourceUrl={urlByDoc.get(row.docId)}
                onUpdate={onUpdate}
                onRemove={onRemove}
                onConfirm={onConfirm}
              />
            ))}
          </Table.Body>
        </Table>
      </div>
    </section>
  );
}

/** The four editable fields, held as strings while an input is open. */
interface Draft {
  date: string;
  description: string;
  provider: string;
  cost: string;
}

function toDraft(row: EventRow): Draft {
  return {
    date: row.date === "unknown" ? "" : row.date,
    description: row.description,
    provider: row.provider,
    cost: row.cost === null ? "" : String(row.cost)
  };
}

/** Empty → no cost; anything unparseable also collapses to `null`. */
function parseCost(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

interface ReviewRowProps {
  row: EventRow;
  sourceUrl?: string;
  onUpdate: (id: string, patch: EventPatch) => void;
  onRemove: (id: string) => void;
  onConfirm: (id: string) => void;
}

function ReviewRow({
  row,
  sourceUrl,
  onUpdate,
  onRemove,
  onConfirm
}: ReviewRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(row));

  const flagged = needsReview(row);

  function startEdit() {
    setDraft(toDraft(row));
    setEditing(true);
  }

  function save() {
    onUpdate(row.id, {
      date: draft.date.trim() === "" ? "unknown" : draft.date,
      description: draft.description.trim(),
      provider: draft.provider.trim(),
      cost: parseCost(draft.cost)
    });
    setEditing(false);
  }

  return (
    <Table.Row className={flagged ? "bg-kumo-warning/10" : undefined}>
      <Table.Cell className="align-top whitespace-nowrap">
        {editing ? (
          <Input
            type="date"
            size="sm"
            className="w-36"
            aria-label="Event date"
            value={draft.date}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, date: event.target.value }))
            }
          />
        ) : (
          <DateText date={row.date} />
        )}
      </Table.Cell>

      <Table.Cell className="min-w-56 align-top">
        {editing ? (
          <Input
            size="sm"
            className="w-full"
            aria-label="Event description"
            value={draft.description}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        ) : (
          <span className="text-kumo-default">{row.description}</span>
        )}
      </Table.Cell>

      <Table.Cell className="align-top">
        {editing ? (
          <Input
            size="sm"
            className="w-40"
            aria-label="Provider"
            value={draft.provider}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, provider: event.target.value }))
            }
          />
        ) : (
          <span className="text-kumo-default">{row.provider || "—"}</span>
        )}
      </Table.Cell>

      <Table.Cell className="align-top text-right tabular-nums whitespace-nowrap">
        {editing ? (
          <Input
            type="number"
            step="0.01"
            min="0"
            size="sm"
            className="w-28 text-right"
            aria-label="Cost"
            value={draft.cost}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, cost: event.target.value }))
            }
          />
        ) : row.cost === null ? (
          <span className="text-kumo-secondary">—</span>
        ) : (
          <span className="text-kumo-default">{CURRENCY.format(row.cost)}</span>
        )}
      </Table.Cell>

      <Table.Cell className="align-top whitespace-nowrap">
        <SourceLink row={row} url={sourceUrl} />
      </Table.Cell>

      <Table.Cell className="align-top">
        <ConfidenceCell row={row} onConfirm={() => onConfirm(row.id)} />
      </Table.Cell>

      <Table.Cell className="align-top text-right whitespace-nowrap">
        {editing ? (
          <div className="inline-flex gap-1">
            <Button
              variant="ghost"
              shape="square"
              size="sm"
              aria-label="Save changes"
              icon={<CheckIcon size={15} />}
              onClick={save}
            />
            <Button
              variant="ghost"
              shape="square"
              size="sm"
              aria-label="Cancel editing"
              icon={<XIcon size={15} />}
              onClick={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="inline-flex gap-1">
            <Button
              variant="ghost"
              shape="square"
              size="sm"
              aria-label={`Edit ${row.description}`}
              icon={<PencilSimpleIcon size={15} />}
              onClick={startEdit}
            />
            <Button
              variant="ghost"
              shape="square"
              size="sm"
              aria-label={`Delete ${row.description}`}
              icon={<TrashIcon size={15} />}
              onClick={() => onRemove(row.id)}
            />
          </div>
        )}
      </Table.Cell>
    </Table.Row>
  );
}

/** ISO date, or a muted "Unknown" for the literal `"unknown"`. */
function DateText({ date }: { date: string }) {
  if (date === "unknown") {
    return <span className="text-kumo-secondary">Unknown</span>;
  }
  return <span className="text-kumo-default tabular-nums">{date}</span>;
}

/** `bill.pdf, p.2` — links to the original file when its object URL exists. */
function SourceLink({ row, url }: { row: EventRow; url?: string }) {
  const label =
    row.source_page !== null
      ? `${row.source_file}, p.${row.source_page}`
      : row.source_file;

  if (!url) {
    return (
      <Text size="xs" variant="secondary">
        {label}
      </Text>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-kumo-brand hover:underline"
    >
      <span className="max-w-40 truncate">{label}</span>
      <ArrowSquareOutIcon size={12} className="shrink-0" />
    </a>
  );
}

/**
 * High → a green badge. Low & unreviewed → an amber badge the reviewer can
 * click to confirm. Low & resolved → a neutral "reviewed" badge.
 */
function ConfidenceCell({
  row,
  onConfirm
}: {
  row: EventRow;
  onConfirm: () => void;
}) {
  if (row.confidence === "high") {
    return (
      <Badge variant="success">
        <CheckCircleIcon size={12} weight="fill" className="mr-1" />
        High
      </Badge>
    );
  }

  if (needsReview(row)) {
    return (
      <button
        type="button"
        onClick={onConfirm}
        aria-label="Confirm this low-confidence event"
        className="cursor-pointer"
      >
        <Badge variant="warning">
          <WarningIcon size={12} weight="fill" className="mr-1" />
          Review
        </Badge>
      </button>
    );
  }

  return (
    <Badge variant="secondary">
      <CheckCircleIcon size={12} className="mr-1" />
      Reviewed
    </Badge>
  );
}
