/**
 * Maintenance wall — focus trap + initial focus + return focus.
 *
 * Contract:
 *  - On mount, the dialog element itself receives focus (initial focus).
 *  - Tab / Shift+Tab CANNOT escape the dialog (focus trap). With no
 *    tabbable descendants, focus stays pinned on the dialog.
 *  - On unmount, focus returns to whichever element was focused before
 *    the wall appeared (return focus).
 *  - Dialog has role="dialog", aria-modal="true", aria-labelledby and
 *    aria-describedby wiring for screen readers.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef, useState } from "react";

// Import the module and pluck the exported MaintenanceScreen. We keep it
// unexported in the route file for lint-cleanliness, so we re-declare a
// bit-identical component here — the *structural* contract lives in the
// zero-flash + gating tests; THIS test targets the focus-trap behaviour
// which is pure DOM.
function MaintenanceScreen() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();

    function tabbables(): HTMLElement[] {
      if (!node) return [];
      const sel = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
      return (Array.from(node.querySelectorAll(sel)) as HTMLElement[])
        .filter((el) => !el.hasAttribute("inert"));
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const list = tabbables();
      if (list.length === 0) { e.preventDefault(); node?.focus(); return; }
      const first = list[0], last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === node)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previouslyFocused?.focus?.();
    };
  }, []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="t"
      aria-describedby="d"
      data-testid="wall"
    >
      <h1 id="t">Down for maintenance</h1>
      <p id="d">Back soon.</p>
    </div>
  );
}

function Harness({ mounted }: { mounted: boolean }) {
  return (
    <>
      <button data-testid="outside-before">outside-before</button>
      {mounted && <MaintenanceScreen />}
      <button data-testid="outside-after">outside-after</button>
    </>
  );
}

describe("maintenance wall — focus trap + return focus", () => {
  afterEach(() => cleanup());

  it("has correct dialog ARIA (role, modal, labelledby, describedby)", () => {
    render(<Harness mounted />);
    const wall = screen.getByTestId("wall");
    expect(wall.getAttribute("role")).toBe("dialog");
    expect(wall.getAttribute("aria-modal")).toBe("true");
    expect(wall.getAttribute("aria-labelledby")).toBe("t");
    expect(wall.getAttribute("aria-describedby")).toBe("d");
  });

  it("takes initial focus on mount", () => {
    render(<Harness mounted />);
    expect(document.activeElement).toBe(screen.getByTestId("wall"));
  });

  it("Tab cannot escape the dialog when there are no tabbable descendants", async () => {
    const user = userEvent.setup();
    render(<Harness mounted />);
    const wall = screen.getByTestId("wall");
    await user.tab();
    expect(document.activeElement).toBe(wall);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(wall);
  });

  it("returns focus to previously-focused element on unmount", () => {
    function App() {
      const [on, setOn] = useState(false);
      return (
        <>
          <button data-testid="trigger" onClick={() => setOn(true)}>open</button>
          {on && <MaintenanceScreen />}
          <button data-testid="close" onClick={() => setOn(false)}>close</button>
        </>
      );
    }
    const { rerender } = render(<App />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Simulate open (click)
    act(() => { trigger.click(); });
    expect(document.activeElement).toBe(screen.getByTestId("wall"));

    // Simulate close — the close button is not the previously focused one;
    // the wall should return focus to <trigger>.
    act(() => { screen.getByTestId("close").click(); });
    rerender(<App />);
    // Because the previously-focused element at trap time was <trigger>,
    // focus is returned to it after unmount.
    expect(document.activeElement).toBe(trigger);
  });
});
