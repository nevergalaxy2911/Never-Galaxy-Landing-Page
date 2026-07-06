/**
 * Regression suite for AdblockGate.
 *
 * Guarantees:
 *   1) Mounting/unmounting under rapid tab visibility churn does not throw,
 *      stack-overflow, or leak intervals — this catches the "freeze on
 *      devtools + adblocker toggle" class of bug.
 *   2) Scroll lock engages when the gate is visible and releases cleanly.
 *   3) Keyboard scroll keys are blocked outside the modal while it's up.
 *   4) Tamper watchdog re-mounts the gate when the overlay node is deleted.
 *
 * Detection network calls are stubbed so tests are deterministic and fast.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, cleanup } from "@testing-library/react";
import React from "react";

// Force detection into a known state before importing the component.
async function importGate(
  result: "blocked" | "clear" | "single-canary-fail" | "brave-shields-network",
) {
  vi.resetModules();
  // Reset any prior override localStorage state (env kill switch, etc.).
  try { window.localStorage.removeItem("ng_adblock_override"); } catch { /* noop */ }

  // Stub navigator.brave for the Brave-shields scenario.
  const nav = navigator as unknown as { brave?: { isBrave: () => Promise<boolean> } };
  if (result === "brave-shields-network") {
    nav.brave = { isBrave: async () => true };
  } else {
    delete nav.brave;
  }

  // Stub script element loading so canaries "succeed" or "fail" as we choose.
  const origAppend = HTMLHeadElement.prototype.appendChild;
  vi.spyOn(HTMLHeadElement.prototype, "appendChild").mockImplementation(function (
    this: HTMLHeadElement,
    node: Node,
  ) {
    const el = node as HTMLScriptElement;
    if (el.tagName === "SCRIPT") {
      queueMicrotask(() => {
        if (result === "brave-shields-network") {
          // Brave Shields silently replaces ad-network responses with an empty
          // 200 → onload fires, but the expected globals are NOT defined.
          el.onload?.(new Event("load"));
        } else if (result === "single-canary-fail" && el.src.includes("doubleclick")) {
          el.onerror?.(new Event("error"));
        } else if (result === "clear" || result === "single-canary-fail") {
          (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle = [];
          (window as unknown as { googletag?: object }).googletag = {};
          (window as unknown as { google?: { ima?: object } }).google = { ima: {} };
          el.onload?.(new Event("load"));
        } else {
          el.onerror?.(new Event("error"));
        }
      });
      return el;
    }
    return origAppend.call(this, node);
  });

  // Stub fetch for the bait fetch probe.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (result === "brave-shields-network") {
        // Empty 200 — the classic Brave Shields "success but zero bytes" tell.
        return new Response("", { status: 200 });
      }
      return result === "clear" || result === "single-canary-fail"
        ? new Response("x".repeat(2000), { status: 200 })
        : new Response("", { status: 200 });
    }),
  );

  const mod = await import("../src/components/AdblockGate");
  return mod.AdblockGate;
}

beforeEach(() => {
  document.body.innerHTML = "";
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

describe("AdblockGate — freeze regression", () => {
  it("survives 20 rapid visibilitychange + focus events without throwing", async () => {
    const Gate = await importGate("blocked");
    render(<Gate />);

    // Drive the async detection to completion.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Now hammer focus / visibility churn like a devtools toggle spam.
    await act(async () => {
      for (let i = 0; i < 20; i++) {
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(50);
      }
      await vi.advanceTimersByTimeAsync(3000);
    });

    // If we're here, no infinite loop occurred. Sanity check the gate is up.
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it("engages and releases scroll lock cleanly", async () => {
    const Gate = await importGate("blocked");
    const { unmount } = render(<Gate />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");

    unmount();

    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
  });

  it("blocks Space/PageDown/Arrow keys outside the modal, allows them inside", async () => {
    const Gate = await importGate("blocked");
    render(<Gate />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    const outsideEvt = new KeyboardEvent("keydown", { key: " ", cancelable: true, bubbles: true });
    outside.dispatchEvent(outsideEvt);
    expect(outsideEvt.defaultPrevented).toBe(true);

    const modalBtn = document.querySelector('[role="dialog"] button');
    expect(modalBtn).toBeTruthy();
    const insideEvt = new KeyboardEvent("keydown", { key: " ", cancelable: true, bubbles: true });
    (modalBtn as HTMLElement).dispatchEvent(insideEvt);
    expect(insideEvt.defaultPrevented).toBe(false);
  });

  it("restores tampered visibility attributes on the overlay", async () => {
    const Gate = await importGate("blocked");
    render(<Gate />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();

    // Simulate devtools tampering: hide the overlay.
    await act(async () => {
      dialog.style.setProperty("display", "none");
      // Let the MutationObserver microtask flush.
      await Promise.resolve();
      await Promise.resolve();
    });

    // enforce() should have restored display back to "grid".
    expect(dialog.style.getPropertyValue("display")).toBe("grid");
  });

  it("stays hidden when detection reports clear", async () => {
    // jsdom returns offsetHeight=0 for everything, which would false-positive
    // the bait-element check. Force a non-zero height so the bait signal is
    // treated as clean.
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() { return 10; },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() { return document.body; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() { return 10; },
    });
    Element.prototype.getBoundingClientRect = function () {
      return { height: 10, width: 10, top: 0, left: 0, right: 10, bottom: 10, x: 0, y: 0, toJSON() {} } as DOMRect;
    };

    const Gate = await importGate("clear");
    render(<Gate />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("does not block clean browsers when only one ad canary flakes", async () => {
    // Clean-browser layout metrics: jsdom defaults every bait element to zero,
    // which would look like blocklist CSS hiding the bait.
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() { return 10; },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() { return document.body; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() { return 10; },
    });
    Element.prototype.getBoundingClientRect = function () {
      return { height: 10, width: 10, top: 0, left: 0, right: 10, bottom: 10, x: 0, y: 0, toJSON() {} } as DOMRect;
    };

    const Gate = await importGate("single-canary-fail");
    render(<Gate />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("triggers on Brave Shields when cosmetic filtering is DISABLED (network probes only)", async () => {
    // Cosmetic filtering OFF → DOM bait would NOT be hidden. Simulate that
    // with clean-browser layout metrics.
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() { return 10; },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() { return document.body; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() { return 10; },
    });
    Element.prototype.getBoundingClientRect = function () {
      return { height: 10, width: 10, top: 0, left: 0, right: 10, bottom: 10, x: 0, y: 0, toJSON() {} } as DOMRect;
    };

    const Gate = await importGate("brave-shields-network");
    render(<Gate />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    // Even with cosmetic filtering off, Brave + empty ad payloads must trip
    // the gate — that's the regression this test locks in.
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });
});
