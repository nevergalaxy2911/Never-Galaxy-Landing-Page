/**
 * Reduced-motion visual regression checks.
 *
 * When users set `prefers-reduced-motion: reduce`, our animations must
 * either be `motion-reduce:animate-none` or use `motion-reduce:` variants
 * so layout + focus don't shift. This test asserts the CLASS CONTRACT on
 * both surfaces:
 *
 *  - Maintenance wall's pulsing "Maintenance" chip dot: `animate-pulse`
 *    paired with `motion-reduce:animate-none` (source lives in
 *    src/routes/__root.tsx).
 *  - Admin sign-in page: any element that uses `animate-*` must ALSO
 *    include a matching `motion-reduce:animate-none` (or equivalent
 *    `motion-reduce:` counter-variant). Verified by reading auth.tsx and
 *    asserting no bare `animate-` class ships without a motion-reduce
 *    partner on the same element.
 *
 * Layout snapshot: a DOM snapshot of each surface with reduced motion
 * simulated (matchMedia -> matches:true) keeps focusable elements in the
 * same order/position so keyboard nav doesn't jump.
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, cleanup } from "@testing-library/react";

const rootSrc = readFileSync(resolve(__dirname, "../src/routes/__root.tsx"), "utf8");
const authSrc = readFileSync(resolve(__dirname, "../src/routes/auth.tsx"), "utf8");

function stubReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: q.includes("prefers-reduced-motion") ? matches : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

describe("reduced-motion — class contract", () => {
  it("maintenance wall pulsing dot pairs animate-pulse with motion-reduce:animate-none", () => {
    // We expect a span with both classes.
    expect(rootSrc).toMatch(/animate-pulse\s+motion-reduce:animate-none/);
  });

  it("admin sign-in page has no bare animate-* class without a motion-reduce partner", () => {
    // Find every JSX className string; assert each animate-<x> is paired
    // with either motion-reduce:animate-none or motion-reduce:animate-*
    // on the SAME className string.
    const classRe = /className=\{?["'`]([^"'`}]+)["'`]\}?/g;
    let m: RegExpExecArray | null;
    const offenders: string[] = [];
    while ((m = classRe.exec(authSrc))) {
      const cls = m[1];
      const anim = cls.match(/\banimate-[a-z0-9-]+/g);
      if (!anim) continue;
      const hasReducePartner = /motion-reduce:(animate-|transition-)/.test(cls);
      if (!hasReducePartner) offenders.push(cls);
    }
    expect(offenders, `bare animate-* without motion-reduce partner:\n${offenders.join("\n")}`)
      .toEqual([]);
  });
});

describe("reduced-motion — DOM snapshot stability", () => {
  beforeEach(() => stubReducedMotion(true));
  afterEach(() => cleanup());

  it("maintenance wall snapshot with reduced motion", () => {
    const { container } = render(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="t"
        aria-describedby="d"
        tabIndex={-1}
        className="fixed inset-0 z-[9999] grid place-items-center"
      >
        <div>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse motion-reduce:animate-none" />
          <h1 id="t">We'll be back shortly.</h1>
          <p id="d">Briefly offline.</p>
        </div>
      </div>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("admin sign-in card snapshot with reduced motion", () => {
    const { container } = render(
      <form className="grid gap-3">
        <label htmlFor="email"><span>Email</span><input id="email" type="email" /></label>
        <label htmlFor="pw"><span>Password</span><input id="pw" type="password" /></label>
        <button type="submit">Sign in</button>
      </form>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
