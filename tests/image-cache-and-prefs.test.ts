/**
 * Regression tests for the two systems added alongside spatial audio:
 *   • lib/imageCache.ts — localStorage screenshot cache (TTL + LRU + quota).
 *   • hooks/usePref.ts createNumberPref — the persisted wind-intensity slider.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readCachedImage, writeCachedImage, clearImageCache } from "@/lib/imageCache";
import { createNumberPref } from "@/hooks/usePref";

const dataUrl = (kb: number) => "data:image/webp;base64," + "A".repeat(kb * 1024);

describe("imageCache", () => {
  beforeEach(() => {
    localStorage.clear();
    clearImageCache();
  });

  it("returns null for an unknown source", () => {
    expect(readCachedImage("/portfolio/nope.webp")).toBeNull();
  });

  it("round-trips a stored screenshot", () => {
    writeCachedImage("/portfolio/vortex.webp", dataUrl(10));
    expect(readCachedImage("/portfolio/vortex.webp")).toBe(dataUrl(10));
  });

  it("refuses entries that are too large for the localStorage budget", () => {
    writeCachedImage("/portfolio/huge.webp", dataUrl(600));
    expect(readCachedImage("/portfolio/huge.webp")).toBeNull();
  });

  it("evicts least-recently-used entries once over the total budget", () => {
    for (let i = 0; i < 12; i++) writeCachedImage(`/portfolio/${i}.webp`, dataUrl(300));
    // The very first write must have been evicted to make room for later ones.
    expect(readCachedImage("/portfolio/0.webp")).toBeNull();
    expect(readCachedImage("/portfolio/11.webp")).not.toBeNull();
  });

  it("clearImageCache removes everything it wrote", () => {
    writeCachedImage("/portfolio/a.webp", dataUrl(5));
    clearImageCache();
    expect(readCachedImage("/portfolio/a.webp")).toBeNull();
  });

  it("never throws when localStorage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeCachedImage("/portfolio/b.webp", dataUrl(5))).not.toThrow();
    spy.mockRestore();
  });
});

describe("createNumberPref (wind intensity)", () => {
  beforeEach(() => localStorage.clear());

  it("falls back to the default when nothing is stored", () => {
    expect(createNumberPref("test-wind", 0.6).read()).toBe(0.6);
  });

  it("persists and re-reads the slider value", () => {
    const pref = createNumberPref("test-wind", 0.6);
    pref.set(0.25);
    expect(pref.read()).toBeCloseTo(0.25);
  });

  it("clamps out-of-range values to the configured bounds", () => {
    const pref = createNumberPref("test-wind", 0.6, { min: 0, max: 1 });
    pref.set(9);
    expect(pref.read()).toBe(1);
    pref.set(-4);
    expect(pref.read()).toBe(0);
  });

  it("ignores corrupt stored values", () => {
    localStorage.setItem("test-wind", "not-a-number");
    expect(createNumberPref("test-wind", 0.6).read()).toBe(0.6);
  });
});
