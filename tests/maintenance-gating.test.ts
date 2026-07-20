/**
 * Structural guarantee: the root loader in src/routes/__root.tsx is what
 * enforces maintenance mode server-side. This test asserts the invariants
 * that keep the guarantee true, so a well-meaning refactor can't quietly
 * break site-wide gating.
 *
 * Guarantees checked:
 *  1. MAINTENANCE_EXEMPT contains ONLY console paths (/auth, /admin,
 *     /api-panel, /analytics). Adding a public path here would silently
 *     bypass the wall.
 *  2. Every public route under src/routes (excluding _gated/* and auth)
 *     is NOT listed as exempt.
 *  3. The root loader awaits getPublicFlag and returns the payload — i.e.
 *     the flag is evaluated on the server, not the client.
 *  4. RootComponent renders <MaintenanceScreen> BEFORE <AnnouncementBar/
 *     Outlet> when the flag is on and the path isn't exempt (zero flash).
 *  5. A pendingComponent is wired so client-side navigations don't leak
 *     marketing content while the loader is resolving.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "../src/routes/__root.tsx");
const src = readFileSync(ROOT, "utf8");

function listRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listRouteFiles(p, acc);
    else if (/\.tsx?$/.test(name) && !name.endsWith(".gen.ts")) acc.push(p);
  }
  return acc;
}

describe("maintenance gating — server-side, whole-site", () => {
  it("MAINTENANCE_EXEMPT lists only console paths", () => {
    const m = src.match(/MAINTENANCE_EXEMPT\s*=\s*\[([^\]]+)\]/);
    expect(m).toBeTruthy();
    const raw = m![1];
    const paths = [...raw.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    expect(paths.length).toBeGreaterThan(0);
    const allowed = new Set(["/auth", "/admin", "/api-panel", "/analytics"]);
    for (const p of paths) {
      expect(allowed.has(p), `unexpected exempt path: ${p}`).toBe(true);
    }
    // admin surface must be exempt or nobody can turn maintenance back off
    expect(paths).toContain("/admin");
    expect(paths).toContain("/api-panel");
    expect(paths).toContain("/auth");
  });

  it("every public route file is NOT listed as exempt", () => {
    const routesDir = resolve(__dirname, "../src/routes");
    const files = listRouteFiles(routesDir);
    const exempt = new Set([
      "/auth", "/admin", "/api-panel", "/analytics",
    ]);
    for (const f of files) {
      // Skip gated console + special files
      if (f.includes("/_gated/") || f.endsWith("__root.tsx") ||
          f.endsWith("auth.tsx") || f.endsWith("routeTree.gen.ts") ||
          f.includes("/api/")) continue;
      const rel = f.split("/src/routes/")[1];
      // derive URL path from filename (approximate; enough to catch collisions)
      const url = "/" + rel.replace(/\.tsx?$/, "")
        .replace(/\.index$/, "")
        .replace(/^index$/, "")
        .replace(/\./g, "/");
      for (const ex of exempt) {
        // A public route must not start with an exempt prefix
        expect(
          url === ex || url.startsWith(ex + "/"),
          `public route ${url} (${rel}) collides with exempt prefix ${ex}`,
        ).toBe(false);
      }
    }
  });

  it("root loader awaits getPublicFlag on the server", () => {
    // The loader must be async and await getPublicFlag — i.e. the flag
    // is evaluated during SSR so the maintenance HTML is in the first byte.
    expect(src).toMatch(/loader:\s*async/);
    expect(src).toMatch(/await\s+getPublicFlag\s*\(\s*\{\s*data:\s*\{\s*key:\s*"maintenance_mode"\s*\}\s*\}\s*\)/);
  });

  it("RootComponent renders MaintenanceScreen BEFORE marketing when flag is on", () => {
    // The early-return branch must be lexically ahead of <Outlet /> so we
    // never mount the marketing tree while the wall is intended to show.
    const idxWall = src.indexOf("<MaintenanceScreen");
    const idxOutlet = src.indexOf("<Outlet");
    expect(idxWall).toBeGreaterThan(0);
    expect(idxOutlet).toBeGreaterThan(idxWall);
    // Guard clause must include the exempt check
    expect(src).toMatch(/if\s*\(\s*maintenance\s*&&\s*!exempt\s*\)/);
  });

  it("pendingComponent is wired so client-nav shows a skeleton, not marketing", () => {
    expect(src).toMatch(/pendingComponent:\s*MaintenanceSkeleton/);
    expect(src).toMatch(/pendingMs:\s*0/);
  });
});
