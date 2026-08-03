/**
 * Regression tests for the shared link parser and the portfolio card-shape
 * maths. These two modules decide whether a pasted admin URL renders at all
 * and what box the tile reserves, so they are the highest-value unit tests in
 * the project.
 */
import { describe, expect, it } from "vitest";
import { parseYouTubeId, parseMediaLink, parseImageLink } from "../src/lib/media-links";
import {
  DEFAULT_ASPECT,
  aspectRatioCss,
  orientationOf,
  sanitizeAspect,
  sanitizeAspectMap,
  spanForAspect,
} from "../src/lib/portfolio-aspect";

describe("media-links · YouTube id extraction", () => {
  const cases: Array<[string, string]> = [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/YzQltyiVKY1", "YzQltyiVKY1"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ];
  it.each(cases)("parses %s", (url, id) => {
    expect(parseYouTubeId(url)).toBe(id);
  });

  it("returns undefined for non-YouTube links", () => {
    expect(parseYouTubeId("https://vimeo.com/12345")).toBeUndefined();
    expect(parseYouTubeId("")).toBeUndefined();
    expect(parseYouTubeId(null)).toBeUndefined();
  });
});

describe("media-links · admin error messages", () => {
  it("accepts a valid video link and canonicalises it", () => {
    const r = parseMediaLink("https://youtu.be/dQw4w9WgXcQ?t=9", "video");
    expect(r.ok).toBe(true);
    if (r.ok && r.kind === "youtube") {
      expect(r.canonical).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(r.thumb).toContain("dQw4w9WgXcQ");
    }
  });

  it("explains an empty field instead of failing silently", () => {
    const r = parseMediaLink("", "video");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/No link yet/i);
  });

  it("explains a channel link with no video id", () => {
    const r = parseMediaLink("https://www.youtube.com/@nevergalaxy", "video");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no video id/i);
  });

  it("calls out Vimeo and cloud storage specifically", () => {
    const vimeo = parseMediaLink("https://vimeo.com/12345", "video");
    const drive = parseMediaLink("https://drive.google.com/file/d/abc/view", "video");
    expect(vimeo.ok).toBe(false);
    expect(drive.ok).toBe(false);
    if (!vimeo.ok) expect(vimeo.reason).toMatch(/vimeo/i);
    if (!drive.ok) expect(drive.reason).toMatch(/cloud storage/i);
  });

  it("rejects a malformed address", () => {
    const r = parseMediaLink("not a url", "link");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hint).toMatch(/https:\/\//);
  });

  it("rejects a video link pasted into the image field", () => {
    const r = parseImageLink("https://youtu.be/dQw4w9WgXcQ");
    expect(r.ok).toBe(false);
  });

  it("never emits an em dash in admin-facing copy", () => {
    const messages = [
      parseMediaLink("", "video"),
      parseMediaLink("nope", "video"),
      parseMediaLink("https://vimeo.com/1", "video"),
      parseImageLink(""),
    ].flatMap((r) => (r.ok ? [] : [r.reason, r.hint ?? ""]));
    for (const m of messages) expect(m).not.toContain("\u2014");
  });
});

describe("portfolio-aspect · shapes and spans", () => {
  it("defaults to a 16:9 medium card", () => {
    expect(sanitizeAspect(undefined)).toEqual(DEFAULT_ASPECT);
    expect(orientationOf(DEFAULT_ASPECT)).toBe("wide");
  });

  it("detects vertical, square and wide media", () => {
    expect(orientationOf({ ratio: "9:16", width: 1080, height: 1920, size: "m" })).toBe("tall");
    expect(orientationOf({ ratio: "1:1", width: 1080, height: 1080, size: "m" })).toBe("square");
    expect(orientationOf({ ratio: "21:9", width: 2560, height: 1080, size: "m" })).toBe("wide");
  });

  it("gives vertical clips a tall bento card and wide films a wide one", () => {
    const tall = spanForAspect({ ratio: "9:16", width: 1080, height: 1920, size: "m" });
    const wide = spanForAspect({ ratio: "16:9", width: 1920, height: 1080, size: "m" });
    expect(tall).toContain("md:row-span-3");
    expect(wide).toContain("md:col-span-3");
    expect(wide).toContain("md:row-span-2");
  });

  it("emits a usable CSS aspect-ratio", () => {
    expect(aspectRatioCss({ ratio: "9:16", width: 1080, height: 1920, size: "m" })).toBe("1080 / 1920");
  });

  it("repairs junk coming back from the database", () => {
    const map = sanitizeAspectMap({
      good: { ratio: "1:1", width: 1080, height: 1080, size: "l" },
      bad: { ratio: 42, width: -5, height: "x", size: "enormous" },
      broken: null,
    });
    expect(map.good.size).toBe("l");
    expect(map.bad.size).toBe("m");
    expect(map.bad.width).toBeGreaterThan(0);
    expect(map.broken).toEqual(DEFAULT_ASPECT);
  });

  it("ignores a non-object payload entirely", () => {
    expect(sanitizeAspectMap("nope")).toEqual({});
    expect(sanitizeAspectMap(null)).toEqual({});
  });
});
