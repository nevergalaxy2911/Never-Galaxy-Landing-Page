/**
 * Quick smoke test for the adblock freeze fix + focus trap.
 *
 * This is intentionally compact and console-reports a JSON summary so CI logs
 * show the gate behavior at a glance without opening the full regression file.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";

async function importBlockedGate() {
  vi.resetModules();
  vi.spyOn(HTMLHeadElement.prototype, "appendChild").mockImplementation(function (
    this: HTMLHeadElement,
    node: Node,
  ) {
    const el = node as HTMLScriptElement;
    if (el.tagName === "SCRIPT") {
      queueMicrotask(() => el.onerror?.(new Event("error")));
      return el;
    }
    return Node.prototype.appendChild.call(this, node) as Node;
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));
  const mod = await import("../src/components/AdblockGate");
  return mod.AdblockGate;
}

beforeEach(() => {
  document.body.innerHTML = '<button id="outside">Outside</button>';
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.position = "";
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("adblock gate smoke", () => {
  it("runs freeze repair and focus trap checks, then reports to console", async () => {
    const Gate = await importBlockedGate();
    render(<Gate />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const primaryButton = dialog?.querySelector("button") as HTMLButtonElement;
    expect(dialog).toBeTruthy();
    expect(primaryButton).toBeTruthy();

    await act(async () => {
      for (let i = 0; i < 12; i += 1) {
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(25);
      }
      dialog.remove();
      await vi.advanceTimersByTimeAsync(1200);
    });

    const repaired = document.body.contains(dialog);
    expect(repaired).toBe(true);

    await act(async () => {
      primaryButton.focus();
      primaryButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });
    const tabStayedInside = dialog.contains(document.activeElement);
    expect(tabStayedInside).toBe(true);

    const outside = document.getElementById("outside") as HTMLButtonElement;
    await act(async () => {
      outside.focus();
      await Promise.resolve();
    });
    const escapedFocusRecovered = dialog.contains(document.activeElement);
    expect(escapedFocusRecovered).toBe(true);

    const smokeReport = {
      freezeFix: repaired ? "pass" : "fail",
      focusTrap: tabStayedInside && escapedFocusRecovered ? "pass" : "fail",
      gateVisible: Boolean(document.querySelector('[role="dialog"]')),
    };
    console.info("[adblock smoke]", JSON.stringify(smokeReport));
  });
});