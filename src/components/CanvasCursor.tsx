import useCanvasCursor from "@/hooks/use-canvasCursor";
import { useEffect, useState } from "react";

function canUseDesktopCursor() {
  if (typeof window === "undefined") return false;

  // Hard gate: cursor effects are only for laptop/desktop-sized screens with
  // a real fine pointer. Mobile emulation, tablets, and touch laptops stay off.
  const isLargeEnough = window.innerWidth >= 1024;
  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
  const canHover = window.matchMedia("(hover: hover)").matches;
  const hasTouch =
    "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;

  return isLargeEnough && hasFinePointer && canHover && !hasTouch;
}

function DesktopCursorCanvas() {
  useCanvasCursor();
  return (
    <canvas
      id="canvas"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}

/**
 * CanvasCursor — mounts a full-viewport canvas and drives it via
 * useCanvasCursor. Produces a silky, wavy multi-line cursor trail.
 * z-index sits above content but ignores pointer events.
 *
 * Performance / mobile rule: never mount on small screens or touch-capable
 * devices. This prevents the one-frame trail flash seen in mobile dev mode.
 */
export function CanvasCursor() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const update = () => setEnabled(canUseDesktopCursor());
    update();

    const pointerQuery = window.matchMedia("(pointer: fine)");
    const hoverQuery = window.matchMedia("(hover: hover)");
    const widthQuery = window.matchMedia("(min-width: 1024px)");

    pointerQuery.addEventListener("change", update);
    hoverQuery.addEventListener("change", update);
    widthQuery.addEventListener("change", update);
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("touchstart", update, { passive: true });

    return () => {
      pointerQuery.removeEventListener("change", update);
      hoverQuery.removeEventListener("change", update);
      widthQuery.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("touchstart", update);
    };
  }, []);

  if (!enabled) return null;
  return <DesktopCursorCanvas />;
}

export default CanvasCursor;
