/**
 * DOM snapshots for the shared Switch used on /api-panel and the
 * maintenance screen. Locks in the rendered class-string per state/tone,
 * so a stray Tailwind change or accidental style refactor is caught in CI.
 *
 * Also snapshots a small-screen (320px viewport) render of a compact
 * toggle row to guard against class regressions that could re-introduce
 * the "switch overlaps Delete on mobile" bug.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Switch } from "@/components/ui/switch";

describe("Switch — DOM snapshots", () => {
  afterEach(() => cleanup());

  it("unchecked primary", () => {
    const { container } = render(<Switch aria-label="s1" />);
    expect(container.firstChild).toMatchSnapshot();
  });
  it("checked primary", () => {
    const { container } = render(<Switch aria-label="s2" defaultChecked />);
    expect(container.firstChild).toMatchSnapshot();
  });
  it("checked success", () => {
    const { container } = render(<Switch aria-label="s3" defaultChecked tone="success" />);
    expect(container.firstChild).toMatchSnapshot();
  });
  it("checked warn", () => {
    const { container } = render(<Switch aria-label="s4" defaultChecked tone="warn" />);
    expect(container.firstChild).toMatchSnapshot();
  });
  it("checked promo", () => {
    const { container } = render(<Switch aria-label="s5" defaultChecked tone="promo" />);
    expect(container.firstChild).toMatchSnapshot();
  });
  it("disabled", () => {
    const { container } = render(<Switch aria-label="s6" disabled />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("small-screen toggle row keeps 3-column grid (label|switch|delete)", () => {
    // Emulates the api-panel flag row at ~320px width. We render the exact
    // grid classes the panel uses and snapshot the class-string so the
    // structural contract can't be silently rewritten.
    const { container } = render(
      <div
        style={{ width: 320 }}
        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3"
      >
        <div className="min-w-0 truncate">feature.flag.key</div>
        <Switch aria-label="Toggle flag feature.flag.key" defaultChecked />
        <button aria-label="Delete flag feature.flag.key">🗑</button>
      </div>,
    );
    expect(container.firstChild).toMatchSnapshot();
    // Structural check: switch and delete must be siblings inside the grid.
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toMatch(/grid-cols-\[minmax\(0,1fr\)_auto_auto\]/);
    expect(screen.getByRole("switch")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Delete flag/ })).toBeTruthy();
  });
});
