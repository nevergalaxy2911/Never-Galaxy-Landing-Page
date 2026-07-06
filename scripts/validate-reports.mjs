import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const guidePath = resolve(root, "MODIFICATION_GUIDE.md");
const perfPath = resolve(root, "PERFORMANCE.md");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function lineCount(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n$/, "");
  return normalized.length === 0 ? 0 : normalized.split("\n").length;
}

if (!existsSync(guidePath)) fail("MODIFICATION_GUIDE.md is missing");
if (!existsSync(perfPath)) fail("PERFORMANCE.md is missing");

const guide = existsSync(guidePath) ? readFileSync(guidePath, "utf8") : "";
const perf = existsSync(perfPath) ? readFileSync(perfPath, "utf8") : "";

const expectedHeading = "### 2026-07-04 — Adblock gate: overrides + diagnostics endpoint + quorum + Brave test + perf";
// Match the first date-prefixed changelog heading (### YYYY-MM-DD — …),
// skipping structural TOC/section headings like "### Part 1 — Orientation".
const firstChangelogHeading = guide.match(/^### \d{4}-\d{2}-\d{2}[^\n]*$/m)?.[0];
if (firstChangelogHeading !== expectedHeading) {
  fail(`Expected top changelog heading to be '${expectedHeading}', got '${firstChangelogHeading ?? "none"}'`);
}

const requiredGuideSnippets = [
  "Admin / user / env override",
  "Hidden diagnostics endpoint",
  "Quorum-based classifier",
  "Brave Shields regression test",
  "Performance optimisations",
  // Preserved history — the previous top entry must still be present below.
  "Env-tunable thresholds",
  "Focus trap",
  "Debug export",
  "CI workflow",
  "Performance baseline",
  "False-positive-safe detection",
  "Smoke test",
  "Report validation",
  "Modification report export",
];

for (const snippet of requiredGuideSnippets) {
  if (!guide.includes(snippet)) fail(`MODIFICATION_GUIDE.md is missing expected snippet: ${snippet}`);
}

const perfLines = lineCount(perf);
if (perfLines !== 128) fail(`PERFORMANCE.md must have 128 lines, found ${perfLines}`);
if (!perf.includes("Gate no longer freezes the page in the hosted Lovable preview.")) {
  fail("PERFORMANCE.md is missing the adblock gate freeze baseline sentence");
}

if (process.exitCode) process.exit(process.exitCode);

console.log("✅ Report validation passed");
console.log(`   ${expectedHeading}`);
console.log(`   PERFORMANCE.md line count: ${perfLines}`);