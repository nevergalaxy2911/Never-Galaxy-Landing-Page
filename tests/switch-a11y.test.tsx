/**
 * Keyboard + screen-reader accessibility contract for the shared Switch
 * used across /api-panel and the maintenance screen.
 *
 * WHY: Radix ships correct ARIA out of the box, but our compact styling
 * has bitten us twice — once by dropping the accessible name, once by
 * shipping a bespoke pill that swallowed Space/Enter. This test locks in:
 *   1. Every rendered instance exposes role="switch" (SR pickup).
 *   2. It carries an accessible name (aria-label passthrough works).
 *   3. Space toggles state (keyboard reachable, no pointer required).
 *   4. It is focusable via Tab (tabIndex not clobbered).
 *   5. aria-checked reflects state so SRs announce "on/off".
 */
import { describe, it, expect } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

function Harness({ label = "Toggle maintenance mode" }: { label?: string }) {
  const [on, setOn] = useState(false);
  return (
    <div>
      <button>before</button>
      <Switch aria-label={label} checked={on} onCheckedChange={setOn} />
      <button>after</button>
    </div>
  );
}

describe("Switch — a11y contract", () => {
  afterEach(() => cleanup());

  it("exposes role=switch with an accessible name", () => {
    render(<Harness />);
    const sw = screen.getByRole("switch", { name: "Toggle maintenance mode" });
    expect(sw).toBeTruthy();
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("is reachable via Tab (keyboard focusable)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab(); // first button
    await user.tab(); // switch
    expect(document.activeElement).toBe(screen.getByRole("switch"));
  });

  it("toggles on Space and updates aria-checked", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const sw = screen.getByRole("switch");
    sw.focus();
    await user.keyboard(" ");
    expect(sw.getAttribute("aria-checked")).toBe("true");
    await user.keyboard(" ");
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("toggles on Enter as well (Radix convention)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const sw = screen.getByRole("switch");
    sw.focus();
    await user.keyboard("{Enter}");
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("respects disabled state — no toggle from keyboard", async () => {
    const user = userEvent.setup();
    function Dis() {
      const [on, setOn] = useState(false);
      return <Switch aria-label="x" disabled checked={on} onCheckedChange={setOn} />;
    }
    render(<Dis />);
    const sw = screen.getByRole("switch");
    sw.focus();
    await user.keyboard(" ");
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("focus-visible ring class is present (visible focus indicator)", () => {
    render(<Harness />);
    const sw = screen.getByRole("switch");
    expect(sw.className).toMatch(/focus-visible:ring/);
  });

  it("all tones still expose role=switch (primary/success/warn/promo)", () => {
    (["primary", "success", "warn", "promo"] as const).forEach((tone) => {
      const { unmount } = render(<Switch aria-label={`t-${tone}`} tone={tone} />);
      expect(screen.getByRole("switch", { name: `t-${tone}` })).toBeTruthy();
      unmount();
    });
  });
});

// Vitest globals are enabled in vitest.config.ts
declare const afterEach: (fn: () => void) => void;
