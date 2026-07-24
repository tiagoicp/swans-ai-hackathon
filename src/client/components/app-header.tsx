import type { ReactNode } from "react";
import { Link } from "react-router";
import { ThemeToggle } from "./theme-toggle";

interface AppHeaderProps {
  /** Optional pill next to the wordmark naming the current surface. */
  badge?: ReactNode;
  /** Page-specific controls, placed to the left of the theme toggle. */
  children?: ReactNode;
  /** Width of the inner column. Chat runs narrow; the marketing pages don't. */
  contentClassName?: string;
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
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
