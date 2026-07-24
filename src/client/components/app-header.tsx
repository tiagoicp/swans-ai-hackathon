import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@cloudflare/kumo";
import { SignOutIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useAuth } from "@client/lib/auth";
import { ThemeToggle } from "./theme-toggle";

interface AppHeaderProps {
  /** Optional pill next to the wordmark naming the current surface. */
  badge?: ReactNode;
  /** Page-specific controls, placed to the left of the theme toggle. */
  children?: ReactNode;
  /** Width of the inner column. Chat runs narrow; the marketing pages don't. */
  contentClassName?: string;
}

/** Signed-in username plus a log-out button. Renders nothing when logged out. */
function AuthControls() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <span className="flex items-center gap-1.5 text-sm text-kumo-secondary">
        <UserCircleIcon
          size={18}
          weight="fill"
          className="text-kumo-inactive"
        />
        <span className="font-medium text-kumo-default">{user.username}</span>
      </span>
      <Button
        variant="secondary"
        size="sm"
        icon={<SignOutIcon size={16} />}
        onClick={onLogout}
      >
        Log out
      </Button>
    </>
  );
}

/** The wordmark, badge and theme toggle shared by every page. */
export function AppHeader({
  badge,
  children,
  contentClassName = "max-w-3xl"
}: AppHeaderProps) {
  return (
    <header className="px-5 py-4 bg-kumo-base border-b border-kumo-line">
      <div
        className={`${contentClassName} mx-auto flex flex-wrap items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-lg font-semibold text-kumo-default hover:opacity-80 transition-opacity"
          >
            <span className="mr-2">🦢</span>Swans AI
          </Link>
          {badge}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {children}
          <AuthControls />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
