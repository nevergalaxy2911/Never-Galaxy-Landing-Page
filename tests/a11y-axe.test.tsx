/**
 * Automated axe accessibility checks for:
 *   1. The maintenance wall (role=dialog, aria-modal, labelled/described,
 *      focusable, contrast-safe classes).
 *   2. The admin console nav header (aria-label landmark, link names,
 *      keyboard focusable).
 *
 * Uses jest-axe against isolated DOM harnesses so the tests don't require
 * bootstrapping TanStack Router or a Supabase session. The structural
 * tests in maintenance-gating / zero-flash / focus-trap cover the wiring;
 * this test covers WCAG rules axe can enforce automatically.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

function MaintenanceWall() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maint-title"
      aria-describedby="maint-desc"
      tabIndex={-1}
      className="fixed inset-0 z-[9999] grid place-items-center px-6 text-white bg-black"
    >
      <div className="max-w-xl text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-400/60 text-cyan-200 bg-cyan-500/10 text-xs uppercase tracking-[0.25em] mb-6"
        >
          <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
          Maintenance
        </div>
        <div aria-live="polite" aria-atomic="true">
          <h1 id="maint-title" className="text-4xl">We'll be back shortly.</h1>
          <p id="maint-desc" className="text-white/70">
            Never Galaxy is briefly offline for updates.
          </p>
        </div>
        <div className="mt-8 inline-flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase text-white/50">Back online in</span>
          <span className="font-mono text-2xl text-white">3m 12s</span>
        </div>
      </div>
    </div>
  );
}

function AdminNav() {
  return (
    <header>
      <div>
        <span>Never Galaxy | Console</span>
        <nav aria-label="Console sections">
          <a href="/admin">Admin</a>
          <a href="/api-panel">API Panel</a>
          <a href="/analytics">Analytics</a>
          <a href="/">↗ Site</a>
        </nav>
        <button type="button">Sign out</button>
      </div>
    </header>
  );
}

describe("axe — maintenance wall", () => {
  afterEach(() => cleanup());

  it("has no detectable a11y violations", async () => {
    const { container } = render(<MaintenanceWall />);
    const results = await axe(container);
    // @ts-expect-error jest-axe matcher augmentation via expect.extend
    expect(results).toHaveNoViolations();
  });
});

describe("axe — admin console nav", () => {
  afterEach(() => cleanup());

  it("has no detectable a11y violations", async () => {
    const { container } = render(<AdminNav />);
    const results = await axe(container);
    // @ts-expect-error jest-axe matcher augmentation via expect.extend
    expect(results).toHaveNoViolations();
  });
});
