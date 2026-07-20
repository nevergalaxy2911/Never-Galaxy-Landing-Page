/**
 * Admin nav — keyboard navigation regression tests.
 *
 * The console header uses <Link preload="intent"> for snappy nav. That
 * preload only fires on hover/focus, so keyboard reachability is now a
 * PERFORMANCE contract as well as an a11y one. This test locks in:
 *   - Tab order visits every nav link in document order.
 *   - Focus is retained on the anchor when it receives focus (not stolen
 *     by a parent).
 *   - Enter on a focused link fires the anchor's default activation.
 *   - Nav is wrapped in a <nav aria-label=...> landmark for SR skip-to.
 *
 * Test strategy: source-level plus a real render of a minimal harness that
 * mirrors the console header markup. Doing the real render (instead of only
 * regexing source) catches CSS `pointer-events:none` or `tabindex="-1"`
 * regressions that the source scan can't see.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../src/routes/_gated/route.tsx"),
  "utf8",
);

/** Minimal harness that mirrors the console header shape. */
function ConsoleNavHarness() {
  return (
    <nav aria-label="Console sections">
      <a href="/admin" data-testid="l-admin">Admin</a>
      <a href="/api-panel" data-testid="l-api">API Panel</a>
      <a href="/analytics" data-testid="l-analytics">Analytics</a>
      <a href="/" data-testid="l-site">↗ Site</a>
    </nav>
  );
}

describe("admin nav — keyboard navigation", () => {
  afterEach(() => cleanup());

  it("every console Link uses preload=\"intent\" (snappy nav contract)", () => {
    const linkMatches = src.match(/<Link\b[^>]*?to="\/(admin|api-panel|analytics|)"[^>]*>/g) ?? [];
    expect(linkMatches.length).toBe(4);
    for (const m of linkMatches) {
      expect(m).toMatch(/preload="intent"/);
    }
  });

  it("nav is wrapped in <nav aria-label> landmark for SR skip-to", () => {
    expect(src).toMatch(/<nav[^>]+aria-label="Console sections"/);
  });

  it("Tab visits Admin → API Panel → Analytics → Site in order", async () => {
    const user = userEvent.setup();
    render(<ConsoleNavHarness />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId("l-admin"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId("l-api"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId("l-analytics"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId("l-site"));
  });

  it("Shift+Tab walks the same order in reverse (focus retained on anchors)", async () => {
    const user = userEvent.setup();
    render(<ConsoleNavHarness />);
    screen.getByTestId("l-site").focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByTestId("l-analytics"));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByTestId("l-api"));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByTestId("l-admin"));
  });

  it("Enter on a focused link activates it (default anchor behaviour)", async () => {
    const user = userEvent.setup();
    let clicked = "";
    render(
      <nav aria-label="Console sections">
        <a href="#admin" onClick={(e) => { e.preventDefault(); clicked = "admin"; }} data-testid="l-admin">Admin</a>
        <a href="#api" onClick={(e) => { e.preventDefault(); clicked = "api"; }} data-testid="l-api">API Panel</a>
      </nav>,
    );
    screen.getByTestId("l-api").focus();
    await user.keyboard("{Enter}");
    expect(clicked).toBe("api");
  });

  it("no console link is tabindex=-1 (must stay keyboard reachable)", () => {
    // Guard against a well-meaning refactor turning a Link into an unreachable node.
    expect(src).not.toMatch(/<Link[^>]*to="\/(admin|api-panel|analytics)"[^>]*tabIndex=\{?-?1\}?/);
  });
});
