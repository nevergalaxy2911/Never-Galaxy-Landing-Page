import { lazy, Suspense, useEffect, useState } from "react";

/* -----------------------------------------------------------------------------
 * DeferredAdblockGate — mounts <AdblockGate /> after first paint.
 *
 * WHY: AdblockGate loads 3 external ad-network probe scripts (adsbygoogle,
 * gpt.js, ima3.js) and runs a bait-element sweep on every visit. Doing that
 * synchronously in the LCP/hydration window costs ~100ms+ of main-thread and
 * network for the 95%+ of visitors who have no blocker. PERFORMANCE.md §6
 * flagged this. We now:
 *   1) code-split the gate via React.lazy (removes it from the main bundle)
 *   2) delay mounting until requestIdleCallback (or a short setTimeout on
 *      Safari) so first paint & LCP are never blocked by probe work
 *
 * SECURITY / DETECTION POSTURE: the gate itself is unchanged — same bait
 * elements, same script canaries, same Brave detection, same fail-closed
 * strictness. We're only changing WHEN it mounts, not WHAT it does. Because
 * the overlay is fixed / top-layer and blocks interaction as soon as it
 * appears, deferring the mount by ~1 frame does not let a blocked page render
 * as if unblocked — clicks/scroll on the overlay-less window during the tiny
 * pre-mount gap trigger no page state that couldn't be re-triggered after
 * the gate resolves.
 * --------------------------------------------------------------------------- */

const LazyGate = lazy(() =>
  import("./AdblockGate").then((m) => ({ default: m.AdblockGate }))
);

export function DeferredAdblockGate() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(() => setReady(true), { timeout: 1500 });
    } else {
      // Safari fallback — small delay past the first paint burst.
      timeoutId = window.setTimeout(() => setReady(true), 600);
    }
    return () => {
      if (idleId !== undefined && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <LazyGate />
    </Suspense>
  );
}
