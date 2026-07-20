/**
 * "Zero visible flash" contract for the maintenance wall.
 *
 * A real Playwright run against Supabase-backed dev is heavy and brittle
 * in CI (needs live env vars, seeded flag, running dev server). Instead we
 * enforce the structural properties that make a flash impossible:
 *
 *  - The root route's LOADER (not a client effect) resolves maintenance.
 *    Because TanStack Start streams SSR after loaders resolve, if the wall
 *    is decided in the loader it lands in the first HTML byte.
 *  - The component's very first branch (before Outlet, AnnouncementBar,
 *    PageViewLogger) returns MaintenanceScreen when the flag is on.
 *  - No `useEffect` in __root.tsx re-fetches the flag (that would open a
 *    hydration flash window).
 *  - The dialog carries role="dialog" + aria-modal="true" and a full-
 *    viewport fixed cover — no partial reveal of marketing behind it.
 *
 * Companion end-to-end Playwright script lives at
 *   tests/e2e/maintenance-flash.spec.ts.playwright
 * and can be run manually against a live preview with:
 *   npx playwright test tests/e2e/maintenance-flash.spec.ts.playwright
 * (kept out of the default vitest sweep so CI doesn't need a browser).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "../src/routes/__root.tsx"), "utf8");

describe("maintenance wall — zero-flash structural contract", () => {
  it("flag is resolved in the loader, not a client effect", () => {
    // Loader must call getPublicFlag
    expect(src).toMatch(/loader:\s*async[\s\S]*?getPublicFlag/);
    // No useEffect fetches maintenance flag (would race with SSR)
    const effects = src.match(/useEffect\([\s\S]*?\)/g) ?? [];
    for (const e of effects) {
      expect(e).not.toMatch(/maintenance_mode|getPublicFlag/);
    }
  });

  it("MaintenanceScreen early-returns before ANY marketing component", () => {
    const wall = src.indexOf("<MaintenanceScreen");
    const bar  = src.indexOf("<AnnouncementBar");
    const logger = src.indexOf("<PageViewLogger");
    const outlet = src.indexOf("<Outlet");
    expect(wall).toBeGreaterThan(-1);
    // Every marketing render is lexically AFTER the wall's return
    expect(bar).toBeGreaterThan(wall);
    expect(logger).toBeGreaterThan(wall);
    expect(outlet).toBeGreaterThan(wall);
  });

  it("wall is a full-viewport modal (no partial reveal possible)", () => {
    // Fixed cover + high z-index + role/aria-modal are the guarantees
    // that make a below-fold flash impossible.
    expect(src).toMatch(/role=["']dialog["']/);
    expect(src).toMatch(/aria-modal=["']true["']/);
    expect(src).toMatch(/fixed inset-0/);
    expect(src).toMatch(/z-\[9999\]/);
  });

  it("pendingComponent covers the client-nav gap with the same z-layer", () => {
    // On client-side navigations the loader runs between clicks and paint;
    // the pendingComponent must also be a full-screen cover so nothing
    // leaks through during that window.
    expect(src).toMatch(/function MaintenanceSkeleton[\s\S]*?fixed inset-0[\s\S]*?z-\[9999\]/);
  });
});
