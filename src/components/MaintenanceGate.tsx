/**
 * MaintenanceGate — reads the `maintenance_mode` feature flag after first
 * paint and, if ON, replaces the site with a fullscreen "under maintenance"
 * overlay. Admin/console paths (/auth, /admin, /api-panel, /analytics) are
 * exempt so you can still get in and flip the switch off.
 *
 * HOW TO TOGGLE: /api-panel → Maintenance section → flip the switch. The
 * flag lives in the `feature_flags` table (key: maintenance_mode). Anyone
 * loading the site sees the wall within ~1s of first paint.
 */
import { useEffect, useState } from "react";
import { getPublicFlag } from "@/lib/public-flags.functions";

const EXEMPT_PREFIXES = ["/auth", "/admin", "/api-panel", "/analytics"];

export function MaintenanceGate() {
  const [state, setState] = useState<{ on: boolean; title: string; message: string }>({
    on: false,
    title: "We'll be back shortly.",
    message: "Never Galaxy is briefly offline for updates. Thanks for your patience — check back in a few minutes.",
  });

  useEffect(() => {
    let cancelled = false;
    const path = window.location.pathname;
    if (EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return;

    const boot = async () => {
      try {
        const r = await getPublicFlag({ data: { key: "maintenance_mode" } });
        if (cancelled || r.enabled !== true) return;
        const v = (r.value ?? {}) as { title?: string; message?: string };
        setState((s) => ({
          on: true,
          title: (v.title && String(v.title).trim()) || s.title,
          message: (v.message && String(v.message).trim()) || s.message,
        }));
      } catch { /* fail-open */ }
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(() => void boot(), { timeout: 1500 });
    else setTimeout(() => void boot(), 400);
    return () => { cancelled = true; };
  }, []);

  if (!state.on) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] grid place-items-center bg-black text-white px-6"
      style={{ backdropFilter: "blur(8px)" }}
    >
      <div className="max-w-lg text-center">
        <div className="inline-block px-3 py-1 rounded-full border border-fuchsia-500/50 text-fuchsia-300 text-xs uppercase tracking-widest mb-6">
          Maintenance
        </div>
        <h1 className="text-4xl md:text-5xl font-display mb-4 leading-tight">
          {state.title}
        </h1>
        <p className="text-white/70 text-base md:text-lg whitespace-pre-wrap">
          {state.message}
        </p>
      </div>
    </div>
  );
}
