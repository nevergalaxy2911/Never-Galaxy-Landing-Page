import { lazy, Suspense, useEffect, useState } from "react";
import { getPublicFlag } from "@/lib/public-flags.functions";

/* -----------------------------------------------------------------------------
 * DeferredAdblockGate, mounts <AdblockGate /> after first paint AND only if
 * the `adblock_gate_enabled` feature flag is on (default: on). The master
 * switch is toggled from /admin -> Flags -> adblock_gate_enabled.
 *
 * WHY: AdblockGate loads 3 external ad-network probe scripts on every visit.
 * Doing that in the LCP window costs ~100ms+ for the 95%+ of visitors who
 * have no blocker. The flag check is one small Supabase read (public policy)
 * that runs after idle. If the flag is off, no probes ever fire.
 * --------------------------------------------------------------------------- */

const LazyGate = lazy(() =>
  import("./AdblockGate").then((m) => ({ default: m.AdblockGate }))
);

type GateState = "idle" | "flag-loading" | "disabled" | "enabled";

export function DeferredAdblockGate() {
  const [state, setState] = useState<GateState>("idle");

  useEffect(() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    let cancelled = false;

    async function boot() {
      setState("flag-loading");
      try {
        const r = await getPublicFlag({ data: { key: "adblock_gate_enabled" } });
        if (cancelled) return;
        // Default to ON if the flag row is missing or Supabase is unreachable,
        // matches the safe-quorum posture, users on real blockers still get
        // the friendly wall by default.
        setState(r.enabled === false ? "disabled" : "enabled");
      } catch {
        if (!cancelled) setState("enabled");
      }
    }

    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(() => void boot(), { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(() => void boot(), 600);
    }
    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  if (state !== "enabled") return null;
  return (
    <Suspense fallback={null}>
      <LazyGate />
    </Suspense>
  );
}
