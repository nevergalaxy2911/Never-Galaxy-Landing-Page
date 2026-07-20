/**
 * Strict server-side maintenance gating for public assets + non-GET
 * requests, WITHOUT redirect loops.
 *
 * Design invariant enforced by this test:
 *   - The maintenance "wall" is a RENDER (200 OK HTML with a
 *     role=dialog cover), NOT an HTTP redirect. Because there's no
 *     Location header, a client can't loop between /a -> /b -> /a.
 *   - Public assets under `public/` are served by the static host
 *     (Vercel/CF), bypassing the root route entirely. They MUST NOT be
 *     added to the app-level exempt list either, because the exempt
 *     list is a *route* concept and adding asset paths would silently
 *     widen the wall bypass on real routes with the same prefix.
 *   - Server routes under `src/routes/api/**` handle their own HTTP verbs
 *     (GET/POST/etc). The root loader only runs for page routes, so
 *     non-GET requests to `/api/**` don't render the wall — no loop.
 *   - Page routes accept GET (SSR) only; there is no POST handler on a
 *     page route in this repo, so "non-GET to a page route" is a 405
 *     from the platform, not a maintenance redirect.
 *
 * The test asserts the invariants by inspecting the source:
 *   1. __root loader never returns a Response redirect.
 *   2. __root loader never calls `redirect()` from @tanstack/react-router.
 *   3. Every file under src/routes/api/** does NOT import the
 *      maintenance flag helper (they don't gate on it, so no loop).
 *   4. MAINTENANCE_EXEMPT contains no path that looks like an asset
 *      (has a file extension) or a wildcard.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const root = readFileSync(resolve(__dirname, "../src/routes/__root.tsx"), "utf8");

function walk(dir: string, acc: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

describe("maintenance gating — assets + non-GET + no redirect loops", () => {
  it("root loader renders the wall; never issues an HTTP redirect", () => {
    // No `redirect(` calls from @tanstack/react-router in the loader.
    expect(root).not.toMatch(/from ["']@tanstack\/react-router["'][^;]*\bredirect\b/);
    // No `new Response(..., { status: 3xx })` and no Location header.
    expect(root).not.toMatch(/status:\s*30[1278]/);
    expect(root).not.toMatch(/["']Location["']\s*:/);
    // Loader body must return the shape { maintenance, serverNow } —
    // a plain object, not a Response.
    expect(root).toMatch(/return\s*\{\s*maintenance[\s\S]*?serverNow/);
  });

  it("server routes under /api do not import the maintenance flag helper", () => {
    const apiDir = resolve(__dirname, "../src/routes/api");
    let files: string[] = [];
    try { files = walk(apiDir); } catch { /* no api routes yet, ok */ }
    for (const f of files) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const src = readFileSync(f, "utf8");
      expect(src, `${f} must not gate on maintenance flag (would loop non-GET callers)`).not
        .toMatch(/maintenance_mode|getPublicFlag/);
    }
  });

  it("MAINTENANCE_EXEMPT contains only clean route prefixes (no assets, no wildcards)", () => {
    const m = root.match(/MAINTENANCE_EXEMPT\s*=\s*\[([^\]]+)\]/);
    expect(m).toBeTruthy();
    const paths = [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    for (const p of paths) {
      expect(p.startsWith("/"), `exempt entry must be a route path: ${p}`).toBe(true);
      expect(/\.[a-z0-9]+$/i.test(p), `exempt entry must not be an asset path: ${p}`).toBe(false);
      expect(p.includes("*"), `exempt entry must not use wildcards: ${p}`).toBe(false);
    }
  });

  it("exempt matcher uses exact-or-prefix (`p` or `p + '/'`), preventing '/adminfoo' bypass", () => {
    // Guard against a common regression: `path.startsWith("/admin")` alone
    // would exempt `/adminfoo`. The loader must match with `p + "/"` or
    // strict equality — both are present in the current implementation.
    expect(root).toMatch(/path === p \|\| path\.startsWith\(p \+ ["']\/["']\)/);
  });

  it("gating is checked BOTH in the loader and in RootComponent (belt + braces, no loop)", () => {
    // Loader early-returns { maintenance: null } for exempt paths, and
    // RootComponent also recomputes the exempt check before rendering the
    // wall. Two checks converge on the same result, so no ping-pong.
    const loaderCheck = root.indexOf("MAINTENANCE_EXEMPT.some");
    const componentCheck = root.lastIndexOf("MAINTENANCE_EXEMPT.some");
    expect(loaderCheck).toBeGreaterThan(-1);
    expect(componentCheck).toBeGreaterThan(loaderCheck);
  });
});
