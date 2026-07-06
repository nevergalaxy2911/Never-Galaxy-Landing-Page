/* ============================================================================
 * MODIFICATION REPORT — tiny JSON export for the current docs/code change set
 * ----------------------------------------------------------------------------
 * WHY:
 *   During freeze triage, it is useful to download one small JSON payload that
 *   says what changed in the guide/perf docs and what gate behavior is active.
 *   The debug overlay calls this directly; no backend or filesystem read needed.
 * ========================================================================== */

export type ModificationReport = {
  exportedAt: string;
  url?: string;
  userAgent?: string;
  expectedGuideEntry: string;
  performanceReportExpectedLines: number;
  diffSummary: Array<{
    file: string;
    status: "changed" | "unchanged";
    changes: string[];
  }>;
  adblockGate: {
    detectionMode: string;
    falsePositiveFix: string;
    smokeCoverage: string[];
  };
};

export function getModificationReport(): ModificationReport {
  return {
    exportedAt: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    expectedGuideEntry:
      "2026-07-04 — Adblock gate: overrides + diagnostics endpoint + quorum + Brave test + perf",
    performanceReportExpectedLines: 83,
    diffSummary: [
      {
        file: "MODIFICATION_GUIDE.md",
        status: "changed",
        changes: [
          "New top 2026-07-04 entry documents admin/user/env override precedence.",
          "New top entry documents the /api/public/adblock-diagnostics endpoint (GET policy, POST quorum verdict).",
          "New top entry documents the shared quorum classifier in src/lib/adblockPolicy.ts.",
          "New top entry documents the Brave-shields-cosmetic-disabled regression test.",
          "New top entry documents cached Brave detection + Promise.allSettled probe fan-out.",
        ],
      },
      {
        file: "PERFORMANCE.md",
        status: "unchanged",
        changes: [
          "File remains present with the expected 83-line performance baseline.",
          "CI validation still fails if the file is missing or the line count changes unexpectedly.",
        ],
      },
    ],
    adblockGate: {
      detectionMode: "shared quorum classifier (src/lib/adblockPolicy.ts) — client + server agree",
      falsePositiveFix:
        "Blocking requires DOM cosmetic filtering, Brave-shields network tampering, or ≥3 network probes failing together. A single flaky ad canary never opens the gate.",
      smokeCoverage: [
        "rapid focus/visibility churn does not freeze",
        "removed gate DOM node self-repairs",
        "focus starts inside the gate and Tab stays trapped inside",
        "Brave Shields with cosmetic filtering disabled still trips the gate",
        "admin/user override (env / URL / localStorage) can silence or force the gate",
      ],
    },
  };
}

export function exportModificationReport() {
  if (typeof window === "undefined") return;
  const payload = getModificationReport();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `modification-report-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}