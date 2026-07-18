import { exportModificationReport } from "@/lib/modificationReport";

/* ============================================================================
 * ADBLOCK DEBUG, tiny ring-buffer logger + optional on-screen overlay
 * ----------------------------------------------------------------------------
 * WHY:
 *   The gate has multiple defensive systems (scroll lock, tamper watchdog,
 *   focus recheck). When something goes wrong (freeze, false positive, missed
 *   detection) we need a lightweight breadcrumb trail without opening devtools
 *  , because opening devtools is exactly when some of these bugs appeared.
 *
 * HOW TO ENABLE:
 *   • Append `?adblock_debug=1` to the URL, OR
 *   • Run `localStorage.setItem('ng_adblock_debug','1')` in the console once.
 *   Debug logging is a no-op otherwise (zero cost in production).
 *
 * HOW TO MODIFY:
 *   • Change buffer size:  RING_SIZE below.
 *   • Change overlay look: <AdblockDebugOverlay/> at the bottom of this file.
 * ========================================================================== */

const RING_SIZE = 200;

export type AdblockDebugEvent = {
  t: number;         // epoch ms
  tag: string;       // short category, e.g. "check", "tamper", "scroll-lock"
  msg: string;       // human-readable
  data?: unknown;    // optional structured payload
};

type Listener = (events: AdblockDebugEvent[]) => void;

const ring: AdblockDebugEvent[] = [];
const listeners = new Set<Listener>();

export function isAdblockDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URL(window.location.href).searchParams.get("adblock_debug") === "1") {
      return true;
    }
    return window.localStorage?.getItem("ng_adblock_debug") === "1";
  } catch {
    return false;
  }
}

export function adblockLog(tag: string, msg: string, data?: unknown) {
  if (!isAdblockDebugEnabled()) return;
  const evt: AdblockDebugEvent = { t: Date.now(), tag, msg, data };
  ring.push(evt);
  if (ring.length > RING_SIZE) ring.shift();
  // Also echo to console for parity with the overlay.
  // eslint-disable-next-line no-console
  console.debug(`[adblock ${tag}]`, msg, data ?? "");
  listeners.forEach((l) => l([...ring]));
}

export function getAdblockLog(): AdblockDebugEvent[] {
  return [...ring];
}

export function exportAdblockLog(events?: AdblockDebugEvent[]) {
  if (typeof window === "undefined") return;
  const payload = {
    exportedAt: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    events: events ?? getAdblockLog(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adblock-debug-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const overlayBtn: React.CSSProperties = {
  flex: 1,
  padding: "4px 6px",
  background: "rgba(168,85,247,0.2)",
  color: "#f3e8ff",
  border: "1px solid rgba(168,85,247,0.35)",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 10,
};

export function subscribeAdblockLog(l: Listener): () => void {
  listeners.add(l);
  l([...ring]);
  return () => listeners.delete(l);
}

// -------- On-screen overlay ------------------------------------------------

import { useEffect, useState } from "react";

export function AdblockDebugOverlay() {
  // Render nothing during SSR to avoid a hydration mismatch, the debug flag
  // (URL param / localStorage) is only readable on the client.
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<AdblockDebugEvent[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setEnabled(isAdblockDebugEnabled());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return subscribeAdblockLog(setEvents);
  }, [enabled]);

  if (!mounted || !enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 2147483646, // one below the gate itself
        width: collapsed ? 140 : 360,
        maxHeight: collapsed ? 28 : 260,
        overflow: "hidden",
        background: "rgba(10,5,20,0.92)",
        color: "#e0d7ff",
        border: "1px solid rgba(168,85,247,0.35)",
        borderRadius: 8,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "6px 8px",
          background: "rgba(168,85,247,0.15)",
          color: "#f3e8ff",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 11,
        }}
      >
        adblock-debug ({events.length}) {collapsed ? "▲" : "▼"}
      </button>
      {!collapsed && (
        <>
          <div style={{ display: "flex", gap: 6, padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              type="button"
              onClick={() => exportAdblockLog(events)}
              style={overlayBtn}
              title="Download the current breadcrumb ring buffer as JSON"
            >
              ⬇ Export JSON
            </button>
            <button
              type="button"
              onClick={exportModificationReport}
              style={overlayBtn}
              title="Download the current modification guide / performance report summary as JSON"
            >
              ◇ Report JSON
            </button>
            <button
              type="button"
              onClick={() => {
                ring.length = 0;
                listeners.forEach((l) => l([]));
              }}
              style={overlayBtn}
              title="Clear the breadcrumb buffer"
            >
              ✕ Clear
            </button>
          </div>
          <div style={{ maxHeight: 200, overflow: "auto", padding: "4px 8px" }}>
            {events.slice(-80).map((e, i) => (
              <div key={i} style={{ padding: "2px 0", borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
                <span style={{ color: "#c084fc" }}>[{e.tag}]</span> {e.msg}
                {e.data !== undefined && (
                  <span style={{ color: "#a1a1aa" }}> · {safeStringify(e.data)}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}
