import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { buttonVariants, cn } from "@cloudflare/kumo";

/**
 * A link that looks like a Kumo button.
 *
 * Kumo ships `LinkButton`, but it renders a bare `<a>` that ignores the router
 * and full-page reloads. Styling a router `Link` with `buttonVariants()` keeps
 * client-side navigation and real anchor semantics (middle-click, open in new
 * tab) — with one catch, handled below.
 *
 * The catch: `buttonVariants()` returns only class names, and the `primary`
 * variant's classes reference `--kumo-button-emphasis-*`. Those variables are
 * not defined in any stylesheet — the `Button` component computes them into an
 * inline style at render time. Class names alone would leave the background
 * unresolved (white text on transparent). So we set the same two variables the
 * same way Kumo does. Keeping this in one component means one place to update
 * if Kumo's formula ever changes.
 */
const EMPHASIS_STYLE = {
  "--kumo-button-emphasis-bg":
    "color-mix(in oklch, var(--color-kumo-brand), white 30%)",
  "--kumo-button-emphasis-ring":
    "color-mix(in oklch, var(--color-kumo-brand), black 10%)"
} as CSSProperties;

type NavButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type NavButtonSize = "xs" | "sm" | "base" | "lg";

interface NavButtonProps {
  /** In-app route. Mutually exclusive with `href`. */
  to?: string;
  /** Same-page anchor or external URL — rendered as a plain `<a>`. */
  href?: string;
  variant?: NavButtonVariant;
  size?: NavButtonSize;
  className?: string;
  children: ReactNode;
}

export function NavButton({
  to,
  href,
  variant = "secondary",
  size = "base",
  className,
  children
}: NavButtonProps) {
  const props = {
    className: cn(buttonVariants({ variant, size }), className),
    style: variant === "primary" ? EMPHASIS_STYLE : undefined
  };

  return href ? (
    <a href={href} {...props}>
      {children}
    </a>
  ) : (
    <Link to={to ?? "/"} {...props}>
      {children}
    </Link>
  );
}
