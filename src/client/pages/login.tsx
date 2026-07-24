import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Button, Input, LayerCard } from "@cloudflare/kumo";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { AppHeader } from "@client/components/app-header";
import { useAuth } from "@client/lib/auth";

/** Where to land after signing in — set by `RequireAuth` when it redirects here. */
function intendedDestination(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === "string" && from.startsWith("/") ? from : "/";
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = intendedDestination(location.state);

  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (e.g. navigated here by hand) — skip the form.
  if (user) return <Navigate to={destination} replace />;

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      await login(username);
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't sign you in."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-kumo-base">
      <AppHeader />
      <main className="mx-auto flex max-w-md flex-col px-5 pt-20 text-center">
        <div className="mb-4 text-5xl">🦢</div>
        <h1 className="text-3xl font-semibold tracking-tight text-kumo-default">
          Sign in to Swans AI
        </h1>
        <p className="mt-3 text-kumo-secondary">
          Enter a username to continue — no password needed. The same name
          always signs you back into the same account.
        </p>
        <LayerCard className="mt-8 rounded-2xl p-6 text-left ring ring-kumo-line">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              label="Username"
              placeholder="e.g. tiago"
              autoComplete="username"
              value={username}
              error={error ?? undefined}
              disabled={submitting}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              icon={<ArrowRightIcon size={16} weight="bold" />}
              loading={submitting}
              disabled={submitting || username.trim().length === 0}
            >
              {submitting ? "Signing in" : "Continue"}
            </Button>
          </form>
        </LayerCard>
        <p className="mt-6 text-sm text-kumo-inactive">
          This is a prototype gate, not real authentication.
        </p>
      </main>
    </div>
  );
}
