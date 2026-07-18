import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/* -----------------------------------------------------------------------------
 * ThemeToggle, dark ↔ light switch, persisted in localStorage.
 *
 * How it works:
 *   • On mount, reads `ng-theme` from localStorage (default "dark").
 *   • Applies/removes the `.light` class on <html>. All theme overrides
 *     in src/styles.css hang off `.light` (bento surface, cosmic gradient,
 *     shadcn tokens on :root vs .light).
 *   • Persists the choice on every toggle.
 *
 * NOTE: To avoid a flash of the wrong theme on load, the boot script in
 * src/routes/__root.tsx applies the saved class BEFORE hydration.
 * --------------------------------------------------------------------------- */

export type Theme = "dark" | "light";
const STORAGE_KEY = "ng-theme";

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", t === "light");
  root.classList.toggle("dark", t === "dark");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "light";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
  };

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      className={`relative grid place-items-center h-9 w-9 rounded-full border border-border/50 bg-background/40 backdrop-blur transition-all hover:bg-background/70 hover:border-border ${className}`}
    >
      <Sun className={`h-4 w-4 absolute transition-all duration-500 ${isDark ? "opacity-0 -rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"}`} />
      <Moon className={`h-4 w-4 absolute transition-all duration-500 ${isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"}`} />
    </button>
  );
}
