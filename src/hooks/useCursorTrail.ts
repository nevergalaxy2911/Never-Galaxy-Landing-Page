import { useEffect, useState } from "react";

/* -----------------------------------------------------------------------------
 * useCursorTrail — user preference for the canvas ribbon cursor trail.
 *
 * Persists to `localStorage` under `ng-cursor-trail` ("on" | "off").
 * Default: "on". Broadcasts changes via a `ng-cursor-trail-change` CustomEvent
 * so any listener (CanvasCursor, toggle buttons) stays in sync across the app.
 *
 * HOW TO MODIFY:
 *   • Change the default → edit `DEFAULT` below.
 *   • Rename the storage key → update STORAGE_KEY (users lose their saved
 *     preference on next load).
 * --------------------------------------------------------------------------- */

export const CURSOR_TRAIL_STORAGE_KEY = "ng-cursor-trail";
const EVENT_NAME = "ng-cursor-trail-change";
const DEFAULT: "on" | "off" = "on";

export function readCursorTrailPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(CURSOR_TRAIL_STORAGE_KEY);
    if (v === "on") return true;
    if (v === "off") return false;
  } catch { /* private mode */ }
  return DEFAULT === "on";
}

export function setCursorTrailPref(enabled: boolean) {
  try {
    window.localStorage.setItem(CURSOR_TRAIL_STORAGE_KEY, enabled ? "on" : "off");
  } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: enabled }));
}

export function useCursorTrail(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    setEnabled(readCursorTrailPref());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setEnabled(typeof detail === "boolean" ? detail : readCursorTrailPref());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CURSOR_TRAIL_STORAGE_KEY) setEnabled(readCursorTrailPref());
    };
    window.addEventListener(EVENT_NAME, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const set = (v: boolean) => {
    setEnabled(v);
    setCursorTrailPref(v);
  };
  return [enabled, set];
}
