/**
 * Regression test: keeps the API Panel toggle rows on a strict 3-column grid
 * (label | switch | delete) so the switch and Delete button cannot overlap
 * on any width. Also asserts the Maintenance/Announcement rows keep the
 * two-column [content | switch] layout with `minmax(0,1fr)` — the pattern
 * that survived the last two rounds of narrow-screen breakage.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../src/routes/_gated/api-panel.tsx"),
  "utf8",
);

describe("api-panel responsive layout", () => {
  it("Feature flag rows use a 3-column grid so toggle never overlaps Delete", () => {
    expect(src).toMatch(/grid-cols-\[minmax\(0,1fr\)_auto_auto\]/);
  });

  it("Maintenance + Announcement header rows keep [content | switch] 2-col grid", () => {
    const matches = src.match(/grid-cols-\[minmax\(0,1fr\)_auto\]/g) ?? [];
    // one for MaintenanceSection, one for AnnouncementSection
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("Uses the shared Switch component (no bespoke button toggles)", () => {
    expect(src).toContain('from "@/components/ui/switch"');
    // No leftover hand-rolled pill toggles
    expect(src).not.toMatch(/w-16 h-8 rounded-full/);
  });
});
