import { Gauge, Rocket } from "lucide-react";
import { useOptimizedMode } from "@/hooks/useOptimizedMode";

/* -----------------------------------------------------------------------------
 * OptimizedModeToggle, enable/disable "Optimized Mode".
 *
 * Same visual language + behaviour as CursorTrailToggle, but this one is shown
 * on ALL screen sizes because low-end phones benefit the most.
 * Preference persists via useOptimizedMode (localStorage `ng-optimized-mode`).
 * --------------------------------------------------------------------------- */
export function OptimizedModeToggle({ className = "" }: { className?: string }) {
  const [enabled, setEnabled] = useOptimizedMode();

  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      aria-label={`Turn optimized mode ${enabled ? "off" : "on"}`}
      aria-pressed={enabled}
      title={
        enabled
          ? "Optimized mode: on (lighter effects, smoother scrolling)"
          : "Optimized mode: off (full visual effects)"
      }
      className={`relative grid place-items-center h-9 w-9 rounded-full border transition-all backdrop-blur ${
        enabled
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border/50 bg-background/40 hover:bg-background/70 hover:border-border"
      } ${className}`}
    >
      <Gauge
        className={`h-4 w-4 absolute transition-all duration-500 ${enabled ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"}`}
      />
      <Rocket
        className={`h-4 w-4 absolute transition-all duration-500 ${enabled ? "opacity-0 rotate-90 scale-50" : "opacity-70 rotate-0 scale-100"}`}
      />
    </button>
  );
}

export default OptimizedModeToggle;
