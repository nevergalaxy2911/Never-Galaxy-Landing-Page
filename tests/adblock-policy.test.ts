/**
 * Regression tests for src/lib/adblockPolicy.ts
 *
 * WHY THIS FILE EXISTS:
 * We shipped a real Brave Shields false-positive earlier: bare Brave (Shields
 * OFF) tripped the gate because a lone flaky ad-network request combined with
 * `isBrave === true` used to be treated as "blocked". The classifier was
 * rewritten to a quorum model with `isBrave` intentionally NOT used as an
 * amplifier. These tests lock that contract in place so a future edit that
 * re-introduces the Brave amplifier — or lowers the quorum — fails CI loudly
 * instead of silently blocking real Brave users again.
 *
 * Every case below encodes a real-world scenario, with the reason spelled out
 * so a future maintainer knows WHY the expectation is what it is.
 */
import { describe, it, expect } from "vitest";
import {
  classify,
  NETWORK_QUORUM,
  POLICY_VERSION,
  type DetectionSignals,
} from "../src/lib/adblockPolicy";

const clean: DetectionSignals = {
  domBlocked: false,
  scriptBlocked: false,
  gptBlocked: false,
  imaBlocked: false,
  fetchBlocked: false,
  isBrave: false,
};

const s = (overrides: Partial<DetectionSignals> = {}): DetectionSignals => ({
  ...clean,
  ...overrides,
});

describe("adblockPolicy · policy metadata", () => {
  it("exposes a quorum threshold of 4 (unanimous of 4 network probes)", () => {
    expect(NETWORK_QUORUM).toBe(4);
  });

  it("exposes a policy version string", () => {
    expect(typeof POLICY_VERSION).toBe("string");
    expect(POLICY_VERSION.length).toBeGreaterThan(0);
  });
});

describe("adblockPolicy · clean baseline", () => {
  it("reports clear when every probe passes", () => {
    const r = classify(clean);
    expect(r.verdict).toBe("clear");
    expect(r.reasons).toEqual([]);
    expect(r.networkFailures).toBe(0);
  });

  it("stays clear when the visitor is on Brave but nothing else fails", () => {
    // The critical Brave-Shields-OFF baseline — must never regress.
    const r = classify(s({ isBrave: true }));
    expect(r.verdict).toBe("clear");
    expect(r.reasons).toEqual([]);
  });
});

describe("adblockPolicy · Brave Shields false-positive regressions", () => {
  it("stays clear on Brave when exactly ONE ad-network script fails (flaky CDN)", () => {
    // Reality: Google's ad domains occasionally 5xx / rate-limit. On Brave
    // that used to combine with isBrave and produce a bogus "blocked".
    const r = classify(s({ isBrave: true, gptBlocked: true }));
    expect(r.verdict).toBe("clear");
    expect(r.reasons).toEqual([]);
  });

  it("stays clear on Brave when exactly TWO network probes fail (still no quorum)", () => {
    // Two failed network probes is common on strict corporate DNS. Without a
    // fetch-payload signal, we must not classify as blocked.
    const r = classify(s({ isBrave: true, gptBlocked: true, imaBlocked: true }));
    expect(r.verdict).toBe("clear");
    expect(r.networkFailures).toBe(2);
  });

  it("stays clear on Brave when only the fetch payload probe fails (CORS hiccup)", () => {
    // Payload alone is not enough — Rule 2 requires a corroborating script.
    const r = classify(s({ isBrave: true, fetchBlocked: true }));
    expect(r.verdict).toBe("clear");
    expect(r.reasons).toEqual([]);
  });

  it("stays clear on non-Brave when only the fetch payload probe fails", () => {
    const r = classify(s({ fetchBlocked: true }));
    expect(r.verdict).toBe("clear");
  });

  it("stays clear when 3/4 network probes fail but the DOM bait is visible", () => {
    // Below the unanimous quorum AND no payload signal — must be clear.
    const r = classify(
      s({ scriptBlocked: true, gptBlocked: true, imaBlocked: true }),
    );
    expect(r.verdict).toBe("clear");
    expect(r.networkFailures).toBe(3);
  });

  it("isBrave alone is never a reason", () => {
    // Property-style guard: for every combination of one non-Brave signal,
    // toggling isBrave must not change the verdict.
    const probes: Array<keyof DetectionSignals> = [
      "domBlocked", "scriptBlocked", "gptBlocked", "imaBlocked", "fetchBlocked",
    ];
    for (const p of probes) {
      const withoutBrave = classify(s({ [p]: true } as Partial<DetectionSignals>));
      const withBrave = classify(s({ [p]: true, isBrave: true } as Partial<DetectionSignals>));
      expect(withBrave.verdict).toBe(withoutBrave.verdict);
      expect(withBrave.reasons).toEqual(withoutBrave.reasons);
    }
  });
});

describe("adblockPolicy · true-positive detections", () => {
  it("blocks on DOM cosmetic bait alone (Rule 1)", () => {
    const r = classify(s({ domBlocked: true }));
    expect(r.verdict).toBe("blocked");
    expect(r.reasons).toContain("dom-cosmetic-filter");
  });

  it("blocks on payload + one script canary (Rule 2 — Brave Shields ON, cosmetic OFF)", () => {
    const r = classify(s({ fetchBlocked: true, scriptBlocked: true, isBrave: true }));
    expect(r.verdict).toBe("blocked");
    expect(r.reasons).toContain("payload-plus-script");
  });

  it("blocks on unanimous 4/4 network quorum (Rule 3 — uBlock / Pi-hole)", () => {
    const r = classify(
      s({ scriptBlocked: true, gptBlocked: true, imaBlocked: true, fetchBlocked: true }),
    );
    expect(r.verdict).toBe("blocked");
    expect(r.reasons).toContain("network-quorum");
    expect(r.networkFailures).toBe(NETWORK_QUORUM);
  });

  it("accumulates multiple reasons when several rules fire together", () => {
    const r = classify(
      s({
        domBlocked: true,
        fetchBlocked: true,
        scriptBlocked: true,
        gptBlocked: true,
        imaBlocked: true,
      }),
    );
    expect(r.verdict).toBe("blocked");
    expect(r.reasons).toEqual(
      expect.arrayContaining([
        "dom-cosmetic-filter",
        "payload-plus-script",
        "network-quorum",
      ]),
    );
  });
});
