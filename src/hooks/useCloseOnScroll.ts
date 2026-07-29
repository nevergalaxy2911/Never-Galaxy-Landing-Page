import { useEffect } from "react";
import { PANEL_SCROLL_CLOSE_MS } from "@/hooks/useEffectsPrefs";


/* -----------------------------------------------------------------------------
 * useCloseOnScroll — dismiss any floating panel as soon as the PAGE scrolls.
 *
 * WHY: currency picker, contact scope dropdown and the experience popover all
 * float above the page. Scrolling with one of them open used to leave the panel
 * hanging in mid-air (or, worse, drifting away from its trigger). Every panel
 * now closes the moment the document actually moves.
 *
 * IMPORTANT DETAIL — scrolling INSIDE the panel must not close it. The listener
 * is bound to `window` (non-capturing), so scrolls inside a panel's own list are
 * only seen here if they bubble to the document, and we additionally require the
 * document's scrollTop to have changed by more than THRESHOLD_PX.
 *
 * USER CONTROL (Experience menu → both persist to localStorage)
 *   • "Close panels on scroll" (ng-close-panels-scroll) — off keeps every panel
 *     open no matter how far the page moves.
 *   • "Panel close delay"      (ng-panel-scroll-debounce) — how long scrolling
 *     must keep happening before the panel is dismissed. A small delay stops a
 *     stray trackpad nudge from nuking a half-filled form.
 *
 * FORM SAFETY: if the focused element is a text field / select / textarea (or
 * anything contenteditable) the panel is NEVER auto-closed — you're typing in
 * it, so a scroll must not throw your input away.
 *
 * Works with Lenis too: Lenis drives real `window` scroll, so no special case.
 *
 * HOW TO MODIFY
 *   • Make it less/more twitchy → THRESHOLD_PX, or the debounce slider.
 *   • Opt a panel out          → simply don't call the hook there.
 * --------------------------------------------------------------------------- */

const THRESHOLD_PX = 6;

/** True when the visitor is actively typing/choosing inside a form control. */
function isEditingFormField(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useCloseOnScroll(open: boolean, close: () => void) {
  // Always on, fixed delay — see PANEL_SCROLL_CLOSE_MS in useEffectsPrefs.ts.
  const debounceMs = PANEL_SCROLL_CLOSE_MS;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const startY = window.scrollY;
    let timer = 0;

    const fire = () => {
      // Re-check at fire time: focus may have moved into a field mid-scroll.
      if (isEditingFormField()) return;
      close();
    };

    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) <= THRESHOLD_PX) return;
      if (isEditingFormField()) return;
      if (debounceMs <= 0) {
        fire();
        return;
      }
      if (timer) return; // already counting down
      timer = window.setTimeout(fire, debounceMs);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, [open, close, debounceMs]);
}


export default useCloseOnScroll;
