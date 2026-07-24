import { Link } from "react-router";
import { ACTIONS, type ActionDefinition } from "@shared";
import { Badge, LayerCard, Text } from "@cloudflare/kumo";
import {
  ArrowRightIcon,
  FileTextIcon,
  type Icon,
  LightningIcon,
  NewspaperIcon,
  SmileyIcon,
  TranslateIcon
} from "@phosphor-icons/react";

/**
 * Icons live here rather than in the shared catalog: `src/shared` is imported by
 * the Worker and has to stay free of runtime dependencies. The fallback means a
 * new catalog entry renders fine before anyone picks an icon for it.
 */
const ACTION_ICONS: Record<string, Icon> = {
  joke: SmileyIcon,
  summarize: FileTextIcon,
  translate: TranslateIcon,
  digest: NewspaperIcon
};

function ActionIcon({ type }: { type: string }) {
  const IconComponent = ACTION_ICONS[type] ?? LightningIcon;
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-kumo-control text-kumo-brand">
      <IconComponent size={18} weight="duotone" />
    </span>
  );
}

function ActionCard({ action }: { action: ActionDefinition }) {
  const body = (
    <div className="flex items-start gap-3">
      <ActionIcon type={action.type} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Text bold as="span">
            {action.title}
          </Text>
          {action.status === "soon" && <Badge variant="secondary">Soon</Badge>}
        </div>
        <div className="mt-1">
          <Text size="sm" variant="secondary">
            {action.description}
          </Text>
        </div>
      </div>
    </div>
  );

  if (action.status !== "live") {
    return (
      <LayerCard className="rounded-xl p-5 ring ring-kumo-line opacity-60">
        {body}
      </LayerCard>
    );
  }

  return (
    <Link
      to={`/action?type=${encodeURIComponent(action.type)}`}
      className="group block rounded-xl bg-kumo-base p-5 ring ring-kumo-line transition-all hover:ring-kumo-brand hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-ring"
    >
      {body}
      <div className="mt-4 flex items-center gap-1.5 text-kumo-brand">
        <Text size="sm" bold as="span">
          Run it
        </Text>
        <ArrowRightIcon
          size={14}
          weight="bold"
          className="transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}

/** The full Direct Actions catalog as a responsive card grid. */
export function ActionGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ACTIONS.map((action) => (
        <ActionCard key={action.type} action={action} />
      ))}
    </div>
  );
}
