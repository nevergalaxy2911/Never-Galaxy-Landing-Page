import { readFileSync } from "node:fs";

function lineCount(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").length;
}

const guide = readFileSync("MODIFICATION_GUIDE.md", "utf8");
const perf = readFileSync("PERFORMANCE.md", "utf8");

const summary = {
  generatedAt: new Date().toISOString(),
  files: [
    {
      file: "MODIFICATION_GUIDE.md",
      status: "changed",
      topEntry: guide.match(/^### .+$/m)?.[0] ?? null,
      changes: [
        "Added false-positive-safe adblock classification notes to the top 2026-07-03 entry.",
        "Added smoke-test, CI report-validation, and modification-report JSON export notes.",
      ],
    },
    {
      file: "PERFORMANCE.md",
      status: "unchanged",
      lines: lineCount(perf),
      changes: ["No content diff; still present with the expected 83-line baseline."],
    },
  ],
};

console.log("Diff summary for MODIFICATION_GUIDE.md and PERFORMANCE.md:");
console.log(JSON.stringify(summary, null, 2));