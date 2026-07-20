/* ============================================================================
 * ADBLOCK POLICY, shared classifier + quorum used by client AND server
 * ----------------------------------------------------------------------------
 * WHY:
 *   The client-side gate and the /api/public/adblock-diagnostics server route
 *   MUST agree on what "blocked" means. Duplicating the rule in two places
 *   caused drift last time. This module owns the classification, so both
 *   sides call the same function.
 *
 * QUORUM MODEL:
 *   Six independent probe outcomes come in. We classify "blocked" only if a
 *   *quorum* of high-confidence signals agrees. A single flaky ad-network
 *   probe never trips the gate. `isBrave` is intentionally NOT used as an
 *   amplifier, Brave the browser (Shields OFF) still often has one or two
 *   ad-network requests fail for unrelated reasons (CORS, DNS, rate-limits),
 *   and mixing that into the quorum caused persistent false positives.
 *
 *   Rules (any one is sufficient):
 *     1. DOM cosmetic bait is hidden, always accurate; uBlock / AdGuard /
 *        AdBlock / Brave Shields (cosmetic filtering ON) all trip this.
 *     2. Fetch payload probe fails AND at least one script canary fails ,
 *        the payload check is the strongest single signal (Brave replaces
 *        blocked ad scripts with an empty 200), and requiring a second
 *        script failure prevents a lone flaky endpoint from tripping us.
 *     3. All four independent network probes fail together, unanimous
 *        network-layer quorum. Catches Brave Shields with cosmetic filtering
 *        disabled and every third-party network blocker (uBO, Pi-hole, DNS).
 *
 * HOW TO MODIFY:
 *   • Loosen or tighten the quorum: adjust NETWORK_QUORUM below.
 *   • Add a new probe: extend `DetectionSignals` and update `classify()`.
 * ========================================================================== */

export type DetectionSignals = {
  domBlocked: boolean;
  scriptBlocked: boolean;
  gptBlocked: boolean;
  imaBlocked: boolean;
  fetchBlocked: boolean;
  isBrave: boolean;
};

export type Verdict = "blocked" | "clear";

export type ClassificationResult = {
  verdict: Verdict;
  reasons: string[];
  networkFailures: number;
  quorumThreshold: number;
};

// Number of network probes (out of 4) that must ALL fail for rule 3 to fire.
// 4 = unanimous. Anything lower risks false positives on flaky ISPs / Brave.
export const NETWORK_QUORUM = 4;

export function classify(signals: DetectionSignals): ClassificationResult {
  const { domBlocked, scriptBlocked, gptBlocked, imaBlocked, fetchBlocked, isBrave } = signals;
  const networkFailures = [scriptBlocked, gptBlocked, imaBlocked, fetchBlocked].filter(Boolean).length;
  const reasons: string[] = [];

  // Rule 1, cosmetic filter hit is unambiguous.
  if (domBlocked) reasons.push("dom-cosmetic-filter");

  // Rule 2, payload probe + corroborating script canary failures.
  // Brave itself proxies/replaces ad-network scripts with empty 200s even
  // with Shields on "standard" (no cosmetic filtering) — a single script
  // canary failing alongside the payload probe misfires on real Brave
  // users who aren't intentionally blocking. So on Brave we require TWO
  // script canaries to fail before rule 2 fires; everywhere else, one is
  // enough (uBO / AdGuard trip all three anyway).
  const scriptFailures = [scriptBlocked, gptBlocked, imaBlocked].filter(Boolean).length;
  const scriptThreshold = isBrave ? 2 : 1;
  if (fetchBlocked && scriptFailures >= scriptThreshold) reasons.push("payload-plus-script");

  // Rule 3, unanimous network-layer quorum.
  if (networkFailures >= NETWORK_QUORUM) reasons.push("network-quorum");

  return {
    verdict: reasons.length > 0 ? "blocked" : "clear",
    reasons,
    networkFailures,
    quorumThreshold: NETWORK_QUORUM,
  };
}

export const POLICY_VERSION = "2026-07-05";
