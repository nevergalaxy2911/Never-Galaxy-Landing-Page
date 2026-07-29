/* -----------------------------------------------------------------------------
 * autoQuality — automatic "cap preview quality" watchdog.
 *
 * WHAT: watches real frame timings and, the moment the page starts stuttering
 * (sustained low FPS / a burst of long frames), flips a global flag that tells
 * the portfolio previews to stay on the light screenshot.
 *
 * WHY: this used to be a manual switch in the Experience menu. Visitors should
 * never have to diagnose their own GPU — the site now decides for them.
 *
 * HOW IT WORKS
 *   • One shared rAF loop samples frame deltas in ~1s windows.
 *   • A window whose average FPS is below LOW_FPS counts as a "bad" window.
 *   • BAD_WINDOWS bad windows in a row → degrade permanently for this session.
 *   • Once degraded we stop sampling entirely (zero ongoing cost).
 *
 * HOW TO MODIFY
 *   • More/less eager     → LOW_FPS (higher = trips sooner), BAD_WINDOWS.
 *   • Never auto-degrade  → make isQualityCapped() return false.
 * --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

const LOW_FPS = 45;      // below this average for a whole window = "bad"
const BAD_WINDOWS = 2;   // consecutive bad windows before we degrade
const WINDOW_MS = 1000;

let capped = false;
let started = false;
const listeners = new Set<(v: boolean) => void>();

function degrade() {
  if (capped) return;
  capped = true;
  listeners.forEach((cb) => cb(true));
}

/** Starts the watchdog once per page. Safe to call from many components. */
export function startQualityWatchdog() {
  if (started || typeof window === "undefined") return;
  started = true;

  let frames = 0;
  let windowStart = performance.now();
  let badRun = 0;
  let raf = 0;

  const loop = (now: number) => {
    frames++;
    const elapsed = now - windowStart;
    if (elapsed >= WINDOW_MS) {
      const fps = (frames * 1000) / elapsed;
      badRun = fps < LOW_FPS ? badRun + 1 : 0;
      frames = 0;
      windowStart = now;
      if (badRun >= BAD_WINDOWS) {
        degrade();
        cancelAnimationFrame(raf);
        return;
      }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

/** True once the page has proven it can't hold a smooth frame rate. */
export function isQualityCapped(): boolean {
  return capped;
}

export function subscribeQualityCap(cb: (v: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React binding: re-renders the caller when the watchdog trips. */
export function useAutoQualityCap(): boolean {
  const [value, setValue] = useState(false);
  useEffect(() => {
    startQualityWatchdog();
    setValue(isQualityCapped());
    return subscribeQualityCap(setValue);
  }, []);
  return value;
}
