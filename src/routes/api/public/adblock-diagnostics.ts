/* ============================================================================
 * /api/public/adblock-diagnostics, hidden diagnostics endpoint
 * ----------------------------------------------------------------------------
 * GET  → returns the current policy (thresholds, probes, override precedence,
 *        version). Useful for support: "which classifier decided you were
 *        blocked?", you can inspect it without opening devtools.
 *
 * POST → accepts a JSON body of client probe outcomes matching DetectionSignals
 *        and returns the exact classification the server would apply. This is
 *        what "reliable server-side detection with quorum" looks like when the
 *        actual probes must run in the visitor's browser (they must, an ad
 *        blocker only affects the visitor's environment). The server owns the
 *        RULE, the client owns the SIGNALS, and the server hands the visitor
 *        back a verdict they can trust.
 *
 * Under /api/public/* so external callers (support scripts, health checks) can
 * hit it without an auth token. Read-only, no PII, no writes.
 * ========================================================================== */

import { createFileRoute } from "@tanstack/react-router";
import {
  classify,
  NETWORK_QUORUM,
  POLICY_VERSION,
  type DetectionSignals,
} from "@/lib/adblockPolicy";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

function coerceBool(v: unknown): boolean {
  return v === true;
}

function coerceSignals(input: unknown): DetectionSignals | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const keys: Array<keyof DetectionSignals> = [
    "domBlocked", "scriptBlocked", "gptBlocked", "imaBlocked", "fetchBlocked", "isBrave",
  ];
  for (const k of keys) if (typeof o[k] !== "boolean") return null;
  return {
    domBlocked: coerceBool(o.domBlocked),
    scriptBlocked: coerceBool(o.scriptBlocked),
    gptBlocked: coerceBool(o.gptBlocked),
    imaBlocked: coerceBool(o.imaBlocked),
    fetchBlocked: coerceBool(o.fetchBlocked),
    isBrave: coerceBool(o.isBrave),
  };
}

export const Route = createFileRoute("/api/public/adblock-diagnostics")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: () =>
        json({
          policyVersion: POLICY_VERSION,
          quorum: {
            networkThreshold: NETWORK_QUORUM,
            rules: [
              "dom-cosmetic-filter → blocked",
              "brave-shields-network (isBrave AND (fetchBlocked OR ≥2 network failures)) → blocked",
              `network-quorum (≥${NETWORK_QUORUM} network probes fail together) → blocked`,
            ],
          },
          probes: ["domBlocked", "scriptBlocked", "gptBlocked", "imaBlocked", "fetchBlocked", "isBrave"],
          overridePrecedence: [
            "VITE_ADBLOCK_DISABLE=1 env kill switch",
            "?ng_adblock=off|force|auto URL param (persists to localStorage)",
            "localStorage.ng_adblock_override = off|force|auto",
            "default: auto",
          ],
        }),

      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "invalid JSON body" }, 400);
        }
        const signals = coerceSignals((payload as { signals?: unknown })?.signals ?? payload);
        if (!signals) {
          return json(
            {
              error:
                "expected { signals: { domBlocked, scriptBlocked, gptBlocked, imaBlocked, fetchBlocked, isBrave } }, all booleans",
            },
            400,
          );
        }
        const result = classify(signals);
        return json({
          policyVersion: POLICY_VERSION,
          signals,
          ...result,
        });
      },
    },
  },
});
