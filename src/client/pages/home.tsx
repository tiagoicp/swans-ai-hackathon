import { LayerCard, Text } from "@cloudflare/kumo";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ChatCircleDotsIcon,
  ImageIcon,
  LightningIcon,
  ShieldCheckIcon,
  SparkleIcon
} from "@phosphor-icons/react";
import { AppHeader } from "@client/components/app-header";
import { ActionGrid } from "@client/components/action-grid";
import { NavButton } from "@client/components/nav-button";

/** Width of every section's inner column, header included. */
const COLUMN = "max-w-5xl";

// ── Sections ──────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className={`${COLUMN} mx-auto px-5 pt-16 pb-12 text-center`}>
      <div className="text-6xl mb-4">🦢</div>
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-kumo-default">
        Meet Swans AI
      </h1>
      <p className="mt-4 mx-auto max-w-xl text-lg text-kumo-secondary">
        Two ways to get things done: talk it through with Lexi, or fire off a
        Direct Action and get the answer straight back.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <NavButton to="/chat" variant="primary" size="lg">
          Chat with Lexi
          <ArrowRightIcon size={16} weight="bold" />
        </NavButton>
        <NavButton href="#actions" variant="secondary" size="lg">
          Browse Direct Actions
        </NavButton>
      </div>
    </section>
  );
}

function PathCard({
  icon,
  eyebrow,
  title,
  description,
  bullets,
  cta
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  cta: React.ReactNode;
}) {
  return (
    <LayerCard className="flex flex-col rounded-2xl p-6 ring ring-kumo-line">
      <div className="flex size-11 items-center justify-center rounded-xl bg-kumo-control text-kumo-brand">
        {icon}
      </div>
      <div className="mt-4">
        <Text size="xs" variant="secondary" bold as="span">
          {eyebrow.toUpperCase()}
        </Text>
      </div>
      <h3 className="mt-1 text-xl font-semibold text-kumo-default">{title}</h3>
      <p className="mt-2 text-kumo-secondary">{description}</p>
      <ul className="mt-4 space-y-2 flex-1">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <SparkleIcon
              size={14}
              weight="fill"
              className="mt-1 shrink-0 text-kumo-brand"
            />
            <Text size="sm" variant="secondary">
              {bullet}
            </Text>
          </li>
        ))}
      </ul>
      <div className="mt-6">{cta}</div>
    </LayerCard>
  );
}

function TwoPaths() {
  return (
    <section className={`${COLUMN} mx-auto px-5 py-6`}>
      <div className="grid gap-5 md:grid-cols-2">
        <PathCard
          icon={<ChatCircleDotsIcon size={22} weight="duotone" />}
          eyebrow="Conversational"
          title="Swans Lexi"
          description="An agent that keeps the thread. Ask follow-ups, change your mind, drop in an image — Lexi holds the context."
          bullets={[
            "Streams answers as they're written",
            "Reaches for tools when it needs them, and asks before anything sensitive",
            "Remembers the conversation across reconnects"
          ]}
          cta={
            <NavButton to="/chat" variant="primary">
              Open chat
              <ArrowRightIcon size={14} weight="bold" />
            </NavButton>
          }
        />
        <PathCard
          icon={<LightningIcon size={22} weight="duotone" />}
          eyebrow="One-shot"
          title="Direct Actions"
          description="When you already know what you want. Pick an action, give it one detail, and get the result — no conversation required."
          bullets={[
            "One click from anywhere, or a shareable link",
            "Runs as a workflow with visible steps",
            "Nothing to phrase, nothing to prompt"
          ]}
          cta={
            <NavButton href="#actions" variant="secondary">
              See the actions
            </NavButton>
          }
        />
      </div>
    </section>
  );
}

function Actions() {
  return (
    <section
      id="actions"
      className={`${COLUMN} mx-auto px-5 py-12 scroll-mt-4`}
    >
      <h2 className="text-2xl font-semibold text-kumo-default">
        Direct Actions
      </h2>
      <p className="mt-2 mb-6 text-kumo-secondary">
        Each one runs on its own. More are on the way.
      </p>
      <ActionGrid />
    </section>
  );
}

const FEATURES = [
  {
    icon: <SparkleIcon size={18} weight="duotone" />,
    title: "Streaming answers",
    description: "Responses appear as they're written, thinking included."
  },
  {
    icon: <ShieldCheckIcon size={18} weight="duotone" />,
    title: "Approval on the risky bits",
    description: "Sensitive tool calls stop and wait for your yes."
  },
  {
    icon: <CalendarCheckIcon size={18} weight="duotone" />,
    title: "Scheduling",
    description: "Ask for it later — once, delayed, or on a repeat."
  },
  {
    icon: <ImageIcon size={18} weight="duotone" />,
    title: "Reads images",
    description: "Drop a screenshot in and ask about what's in it."
  }
];

function Features() {
  return (
    <section
      className={`${COLUMN} mx-auto px-5 py-12 border-t border-kumo-line`}
    >
      <h2 className="text-2xl font-semibold text-kumo-default mb-6">
        What's under the hood
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <div key={feature.title}>
            <div className="flex size-9 items-center justify-center rounded-lg bg-kumo-control text-kumo-brand">
              {feature.icon}
            </div>
            <h3 className="mt-3 font-medium text-kumo-default">
              {feature.title}
            </h3>
            <div className="mt-1">
              <Text size="sm" variant="secondary">
                {feature.description}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-kumo-elevated">
      <AppHeader contentClassName={COLUMN}>
        <NavButton to="/chat" variant="ghost" size="sm">
          Open chat
        </NavButton>
      </AppHeader>

      <main>
        <Hero />
        <TwoPaths />
        <Actions />
        <Features />
      </main>

      <footer className={`${COLUMN} mx-auto px-5 py-8`}>
        <Text size="xs" variant="secondary">
          Swans AI — built on Cloudflare Workers for the Swans AI Applied
          Hackathon, Lisbon 2026.
        </Text>
      </footer>
    </div>
  );
}
