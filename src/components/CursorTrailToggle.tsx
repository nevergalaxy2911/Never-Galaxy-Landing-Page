import { MousePointer2, MousePointerClick } from "lucide-react";
import { useCursorTrail } from "@/hooks/useCursorTrail";

/* -----------------------------------------------------------------------------
 * CursorTrailToggle, enable/disable the canvas ribbon cursor trail.
 *
 * The trail itself is a desktop-only decorative effect (see CanvasCursor).
 * This button is hidden on small screens where the trail never runs anyway.
 * Preference is persisted via useCursorTrail (localStorage key `ng-cursor-trail`).
 * --------------------------------------------------------------------------- */
export function CursorTrailToggle({ className = "" }: { className?: string }) {
  const [enabled, setEnabled] = useCursorTrail();

  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      aria-label={`Turn cursor trail ${enabled ? "off" : "on"}`}
      aria-pressed={enabled}
      title={`Cursor trail: ${enabled ? "on" : "off"}`}
      className={`relative hidden lg:grid place-items-center h-9 w-9 rounded-full border border-border/50 bg-background/40 backdrop-blur transition-all hover:bg-background/70 hover:border-border ${className}`}
    >
      <MousePointer2
        className={`h-4 w-4 absolute transition-all duration-500 ${enabled ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"}`}
      />
      <MousePointerClick
        className={`h-4 w-4 absolute transition-all duration-500 opacity-40 ${enabled ? "opacity-0 rotate-90 scale-50" : "opacity-70 rotate-0 scale-100"}`}
      />
    </button>
  );
}
