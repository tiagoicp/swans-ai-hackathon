import { useCallback, useState } from "react";
import { Button } from "@cloudflare/kumo";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";

/**
 * Flips `data-mode` on the document root and remembers the choice.
 *
 * The initial value is applied by the inline script in `index.html` before
 * React mounts, so there is no flash of the wrong theme — this only reads what
 * that script already decided.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute("data-mode") === "dark"
  );

  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    const mode = next ? "dark" : "light";
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("theme", mode);
  }, [dark]);

  return (
    <Button
      variant="secondary"
      shape="square"
      icon={dark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    />
  );
}
