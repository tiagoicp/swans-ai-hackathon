import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  findAction,
  type ActionDefinition,
  type ActionRunState
} from "@shared";
import {
  Badge,
  Button,
  Input,
  LayerCard,
  Loader,
  Text
} from "@cloudflare/kumo";
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ChatCircleDotsIcon,
  LightningIcon,
  PlayIcon,
  WarningCircleIcon
} from "@phosphor-icons/react";
import { AppHeader } from "@client/components/app-header";
import { ActionGrid } from "@client/components/action-grid";
import { NavButton } from "@client/components/nav-button";
import { startRun, watchRun } from "@client/lib/run-action";

const COLUMN = "max-w-3xl";

// ── Picker ────────────────────────────────────────────────────────────

function Picker({ unknownType }: { unknownType?: string }) {
  return (
    <div className="space-y-6">
      {unknownType && (
        <LayerCard className="flex items-start gap-3 rounded-xl p-4 ring ring-kumo-warning">
          <WarningCircleIcon
            size={18}
            className="mt-0.5 shrink-0 text-kumo-warning"
          />
          <Text size="sm">
            There's no action called “{unknownType}”. Pick one from the list
            below.
          </Text>
        </LayerCard>
      )}
      <div>
        <h1 className="text-2xl font-semibold text-kumo-default">
          Direct Actions
        </h1>
        <p className="mt-2 mb-6 text-kumo-secondary">
          One click, one result — no conversation required.
        </p>
        <ActionGrid />
      </div>
    </div>
  );
}

// ── Not-yet-available ─────────────────────────────────────────────────

function ComingSoon({ action }: { action: ActionDefinition }) {
  return (
    <div className="space-y-6">
      <LayerCard className="rounded-xl p-6 ring ring-kumo-line">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-kumo-default">
            {action.title}
          </h1>
          <Badge variant="secondary">Soon</Badge>
        </div>
        <p className="mt-2 text-kumo-secondary">{action.description}</p>
        <p className="mt-4">
          <Text size="sm" variant="secondary">
            This one isn't wired up yet. In the meantime, Lexi can probably
            help.
          </Text>
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <NavButton to="/chat" variant="primary">
            <ChatCircleDotsIcon size={14} weight="bold" />
            Ask Lexi instead
          </NavButton>
          <NavButton to="/action" variant="secondary">
            All actions
          </NavButton>
        </div>
      </LayerCard>
    </div>
  );
}

// ── Runner ────────────────────────────────────────────────────────────

function Runner({ action }: { action: ActionDefinition }) {
  const countInput = action.countInput;
  const [searchParams, setSearchParams] = useSearchParams();
  const [count, setCount] = useState(String(countInput?.defaultValue ?? 1));

  // The run id lives in the URL rather than in state, so a reload — or someone
  // else opening the link — rejoins the same workflow instead of starting over.
  const runId = searchParams.get("run");

  // Landing on a URL that already names a run means we are reattaching, not
  // idling. Deciding that here rather than in an effect avoids a frame of empty
  // form before the first poll answers.
  const [state, setState] = useState<ActionRunState>(() =>
    runId
      ? {
          status: "running",
          step: "Connecting to the run",
          stepIndex: 0,
          stepCount: 0
        }
      : { status: "idle" }
  );

  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    watchRun(runId, setState, controller.signal);
    // Stops the polling only. The workflow keeps going without us.
    return () => controller.abort();
  }, [runId]);

  const parsed = Number(count);
  const countError =
    countInput &&
    (!Number.isInteger(parsed) ||
      parsed < countInput.min ||
      parsed > countInput.max)
      ? `Enter a whole number between ${countInput.min} and ${countInput.max}.`
      : undefined;

  const isRunning = state.status === "running";

  // Starting a run only writes the new id to the URL; the effect above notices
  // and does the watching. Ids are unique, so "Run again" is the same path.
  const start = useCallback(async () => {
    if (countError || isRunning) return;
    setState({
      status: "running",
      step: "Starting the workflow",
      stepIndex: 0,
      stepCount: 0
    });
    try {
      const id = await startRun(action.type, parsed);
      setSearchParams({ type: action.type, run: id }, { replace: true });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Couldn't start the run."
      });
    }
  }, [action.type, countError, isRunning, parsed, setSearchParams]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/action"
          className="inline-flex items-center gap-1 text-sm text-kumo-secondary hover:text-kumo-default transition-colors"
        >
          <ArrowLeftIcon size={14} />
          All actions
        </Link>
      </div>

      <LayerCard className="rounded-xl p-6 ring ring-kumo-line">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-kumo-control text-kumo-brand">
            <LightningIcon size={20} weight="duotone" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-kumo-default">
              {action.title}
            </h1>
            <p className="mt-1 text-kumo-secondary">{action.description}</p>
          </div>
        </div>

        <form
          className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          {countInput && (
            <Input
              type="number"
              className="w-40"
              label={countInput.label}
              description={countError ? undefined : countInput.description}
              error={countError}
              min={countInput.min}
              max={countInput.max}
              value={count}
              disabled={isRunning}
              onChange={(e) => setCount(e.target.value)}
            />
          )}
          <Button
            type="submit"
            variant="primary"
            icon={<PlayIcon size={16} weight="fill" />}
            loading={isRunning}
            disabled={Boolean(countError) || isRunning}
          >
            {isRunning ? "Running" : "Run action"}
          </Button>
        </form>
      </LayerCard>

      {isRunning && (
        <LayerCard className="flex items-center gap-3 rounded-xl p-5 ring ring-kumo-line">
          <Loader size="sm" />
          <div>
            <Text size="sm" bold as="span">
              {state.step}
            </Text>
            {/* Nothing to count until the workflow reports its first step. */}
            {state.stepCount > 0 && (
              <div>
                <Text size="xs" variant="secondary">
                  Step {state.stepIndex} of {state.stepCount}
                </Text>
              </div>
            )}
          </div>
        </LayerCard>
      )}

      {state.status === "error" && (
        <LayerCard className="flex items-start gap-3 rounded-xl p-5 ring ring-kumo-danger">
          <WarningCircleIcon
            size={18}
            className="mt-0.5 shrink-0 text-kumo-danger"
          />
          <div className="flex-1">
            <Text size="sm">{state.message}</Text>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowClockwiseIcon size={14} />}
                onClick={start}
              >
                Try again
              </Button>
            </div>
          </div>
        </LayerCard>
      )}

      {state.status === "complete" && (
        <LayerCard className="rounded-xl p-6 ring ring-kumo-line">
          <Text size="xs" variant="secondary" bold as="span">
            RESULT
          </Text>
          <ol className="mt-3 space-y-3">
            {state.results.map((result, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-kumo-inactive tabular-nums">
                  {i + 1}.
                </span>
                <span className="text-kumo-default leading-relaxed">
                  {result}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              icon={<ArrowClockwiseIcon size={14} />}
              onClick={start}
            >
              Run again
            </Button>
            <NavButton to="/chat" variant="ghost">
              <ChatCircleDotsIcon size={14} weight="bold" />
              Ask Lexi instead
            </NavButton>
          </div>
        </LayerCard>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function Action() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type");
  const action = findAction(type);

  let content;
  if (!action) {
    content = <Picker unknownType={type ?? undefined} />;
  } else if (action.status !== "live") {
    content = <ComingSoon action={action} />;
  } else {
    content = <Runner key={action.type} action={action} />;
  }

  return (
    <div className="min-h-screen bg-kumo-elevated">
      <AppHeader
        contentClassName={COLUMN}
        badge={
          <Badge variant="secondary">
            <LightningIcon size={12} weight="bold" className="mr-1" />
            Direct Action
          </Badge>
        }
      />
      <main className={`${COLUMN} mx-auto px-5 py-8`}>{content}</main>
    </div>
  );
}
