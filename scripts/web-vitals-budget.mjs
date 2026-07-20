#!/usr/bin/env node
/**
 * Web Vitals budget check.
 *
 * Enforces performance budgets in CI without changing the site's look.
 * Runs Google PageSpeed Insights (real Lighthouse Lab data + optionally
 * field CrUX) against a target URL and fails the build if any Core Web
 * Vital exceeds its budget.
 *
 * USAGE (local):
 *   TARGET_URL=https://nevergalaxy.vercel.app node scripts/web-vitals-budget.mjs
 *
 * USAGE (CI, e.g. GitHub Actions):
 *   env:
 *     TARGET_URL: ${{ secrets.PROD_URL }}
 *     PSI_API_KEY: ${{ secrets.PSI_API_KEY }}   # optional, higher rate limit
 *   run: node scripts/web-vitals-budget.mjs
 *
 * BUDGETS (mobile strategy — the hardest bar):
 *   LCP  ≤ 2500 ms   (Largest Contentful Paint)
 *   INP  ≤ 200  ms   (Interaction to Next Paint)
 *   CLS  ≤ 0.10      (Cumulative Layout Shift)
 *   TBT  ≤ 200  ms   (secondary — INP proxy in lab data)
 *
 * Override any budget via env:
 *   LCP_BUDGET_MS=3000  CLS_BUDGET=0.15  INP_BUDGET_MS=250
 *
 * Exit code is non-zero if any budget is exceeded, so this fits directly
 * into a `- run:` step in any CI provider.
 */

const TARGET_URL = process.env.TARGET_URL || "https://nevergalaxy.vercel.app/";
const STRATEGY = process.env.STRATEGY || "mobile"; // "mobile" | "desktop"
const PSI_API_KEY = process.env.PSI_API_KEY || ""; // optional

const BUDGETS = {
  LCP_MS: Number(process.env.LCP_BUDGET_MS ?? 2500),
  INP_MS: Number(process.env.INP_BUDGET_MS ?? 200),
  CLS:    Number(process.env.CLS_BUDGET    ?? 0.10),
  TBT_MS: Number(process.env.TBT_BUDGET_MS ?? 200),
};

function fmt(n, unit = "") {
  if (n == null || Number.isNaN(n)) return "n/a";
  return typeof n === "number" ? `${n.toFixed(unit === "" ? 3 : 0)}${unit}` : String(n);
}

async function main() {
  const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  url.searchParams.set("url", TARGET_URL);
  url.searchParams.set("strategy", STRATEGY);
  ["performance", "accessibility", "best-practices", "seo"].forEach((c) =>
    url.searchParams.append("category", c),
  );
  if (PSI_API_KEY) url.searchParams.set("key", PSI_API_KEY);

  console.log(`[web-vitals-budget] Auditing ${TARGET_URL} (${STRATEGY})`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`PSI request failed: ${res.status} ${res.statusText}`);
    const body = await res.text().catch(() => "");
    console.error(body.slice(0, 500));
    process.exit(2);
  }
  const json = await res.json();

  // Lab data (always present)
  const audits = json.lighthouseResult?.audits ?? {};
  const lcpMs = audits["largest-contentful-paint"]?.numericValue;
  const cls   = audits["cumulative-layout-shift"]?.numericValue;
  const tbtMs = audits["total-blocking-time"]?.numericValue;
  const perfScore = (json.lighthouseResult?.categories?.performance?.score ?? 0) * 100;

  // Field data (CrUX) — INP only exists in the field, not the lab.
  const crux = json.loadingExperience?.metrics ?? {};
  const inpMs = crux["INTERACTION_TO_NEXT_PAINT"]?.percentile
             ?? crux["EXPERIMENTAL_INTERACTION_TO_NEXT_PAINT"]?.percentile;
  const cruxLcpMs = crux["LARGEST_CONTENTFUL_PAINT_MS"]?.percentile;
  const cruxCls   = crux["CUMULATIVE_LAYOUT_SHIFT_SCORE"]?.percentile != null
                    ? crux["CUMULATIVE_LAYOUT_SHIFT_SCORE"].percentile / 100
                    : undefined;

  const rows = [
    ["Performance score", perfScore, `≥ 90`, perfScore >= 90],
    ["LCP (lab)", `${fmt(lcpMs, "ms")}`, `≤ ${BUDGETS.LCP_MS}ms`, lcpMs != null && lcpMs <= BUDGETS.LCP_MS],
    ["CLS (lab)", `${fmt(cls)}`,          `≤ ${BUDGETS.CLS}`,      cls   != null && cls   <= BUDGETS.CLS],
    ["TBT (lab, INP proxy)", `${fmt(tbtMs, "ms")}`, `≤ ${BUDGETS.TBT_MS}ms`, tbtMs != null && tbtMs <= BUDGETS.TBT_MS],
  ];
  if (inpMs != null)    rows.push(["INP p75 (field)",       `${fmt(inpMs, "ms")}`,     `≤ ${BUDGETS.INP_MS}ms`, inpMs <= BUDGETS.INP_MS]);
  if (cruxLcpMs != null) rows.push(["LCP p75 (field)",      `${fmt(cruxLcpMs, "ms")}`, `≤ ${BUDGETS.LCP_MS}ms`, cruxLcpMs <= BUDGETS.LCP_MS]);
  if (cruxCls   != null) rows.push(["CLS p75 (field)",      `${fmt(cruxCls)}`,         `≤ ${BUDGETS.CLS}`,      cruxCls   <= BUDGETS.CLS]);

  const pad = (s, n) => String(s).padEnd(n);
  console.log("");
  console.log(pad("Metric", 26) + pad("Value", 14) + pad("Budget", 14) + "Status");
  console.log("-".repeat(66));
  let failed = 0;
  for (const [name, val, budget, ok] of rows) {
    const status = ok ? "✅ pass" : "❌ FAIL";
    if (!ok) failed++;
    console.log(pad(name, 26) + pad(String(val), 14) + pad(String(budget), 14) + status);
  }
  console.log("");
  if (failed > 0) {
    console.error(`web-vitals-budget: ${failed} metric(s) exceeded budget on ${TARGET_URL}`);
    process.exit(1);
  }
  console.log(`web-vitals-budget: all budgets met on ${TARGET_URL} (${STRATEGY}).`);
}

main().catch((e) => {
  console.error("web-vitals-budget crashed:", e);
  process.exit(2);
});
