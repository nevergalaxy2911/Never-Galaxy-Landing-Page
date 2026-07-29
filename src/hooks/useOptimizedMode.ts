import { useEffect, useState } from "react";

/* -----------------------------------------------------------------------------
 * useOptimizedMode, user preference for "Optimized Mode".
 *
 * WHAT IT DOES
 *   When ON, the site drops the heaviest decorative work so scrolling stays
 *   pinned at 60fps on modest hardware:
 *     • Starfield: fewer stars, no per-star glow, no drift/twinkle, no cursor
 *       gravity, no nebula gradient repaint (renders one static frame).
 *     • Cursor ribbon trail: disabled.
 *     • Card tilt / border-wedge / spotlight RAF loop: disabled.
 *     • Heavy backdrop-blur surfaces: downgraded to cheap translucency
 *       (see `html[data-optimized="on"]` rules in src/styles.css).
 *
 * STORAGE
 *   localStorage key `ng-optimized-mode` ("on" | "off"). Default: "off".
 *   Changes broadcast a `ng-optimized-mode-change` CustomEvent so every
 *   listener (Starfield, CanvasCursor, InteractiveCards, toggle buttons)
 *   stays in sync without a page reload.
 *
 * HOW TO MODIFY
 *   • Flip the default → change `DEFAULT` below.
 *   • Rename the key → change STORAGE_KEY (users lose saved preference).
 *   • Add a new thing to disable → read `readOptimizedMode()` in that module
 *     and subscribe with `onOptimizedModeChange()`.
 * --------------------------------------------------------------------------- */

export const OPTIMIZED_MODE_STORAGE_KEY = "ng-optimized-mode";
export const OPTIMIZED_MODE_EVENT = "ng-optimized-mode-change";
const DEFAULT: "on" | "off" = "off";

/** Read the saved preference. SSR-safe (returns the default on the server). */
export function readOptimizedMode(): boolean {
  if (typeof window === "undefined") return DEFAULT === "on";
  try {
    const v = window.localStorage.getItem(OPTIMIZED_MODE_STORAGE_KEY);
    if (v === "on") return true;
    if (v === "off") return false;
  } catch {
    /* private mode / storage blocked */
  }
  return DEFAULT === "on";
}

/** Mirror the preference onto <html> so CSS can react to it. */
function applyAttribute(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-optimized", enabled ? "on" : "off");
}

export function setOptimizedMode(enabled: boolean) {
  try {
    window.localStorage.setItem(OPTIMIZED_MODE_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* private mode */
  }
  applyAttribute(enabled);
  window.dispatchEvent(new CustomEvent(OPTIMIZED_MODE_EVENT, { detail: enabled }));
}

/**
 * Subscribe to preference changes (same tab via CustomEvent, other tabs via
 * the `storage` event). Returns an unsubscribe function.
 */
export function onOptimizedModeChange(cb: (enabled: boolean) => void): () => void {
  const onChange = (e: Event) => {
    const detail = (e as CustomEvent<boolean>).detail;
    cb(typeof detail === "boolean" ? detail : readOptimizedMode());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === OPTIMIZED_MODE_STORAGE_KEY) cb(readOptimizedMode());
  };
  window.addEventListener(OPTIMIZED_MODE_EVENT, onChange as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(OPTIMIZED_MODE_EVENT, onChange as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useOptimizedMode(): [boolean, (v: boolean) => void] {
  // Always start at the SSR default so hydration matches, then sync in effect.
  const [enabled, setEnabled] = useState<boolean>(DEFAULT === "on");

  useEffect(() => {
    const initial = readOptimizedMode();
    setEnabled(initial);
    applyAttribute(initial);
    return onOptimizedModeChange(setEnabled);
  }, []);

  const set = (v: boolean) => {
    setEnabled(v);
    setOptimizedMode(v);
  };
  return [enabled, set];
}
