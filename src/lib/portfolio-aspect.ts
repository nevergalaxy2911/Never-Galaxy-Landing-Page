/* =============================================================================
 * PORTFOLIO ASPECT + TILE SIZE, per-item card shaping.
 * -----------------------------------------------------------------------------
 * WHAT THIS DOES
 *   Every portfolio item can declare the shape of its media (16:9, 9:16, 1:1,
 *   or an exact pixel resolution) plus how big its bento card should be.
 *   The public grid then reserves EXACTLY that shape, so a vertical Short is
 *   not letterboxed inside a landscape card and nothing shifts while loading.
 *
 * WHERE IT IS STORED
 *   There is NO new database column. The whole map lives in one existing
 *   `site_settings` row:
 *       key   = "portfolio.aspects"
 *       value = { "<portfolio_item_id>": { ratio, width, height, size } }
 *   That keeps the schema untouched: nothing to migrate, nothing to break.
 *
 * HOW A CARD SIZE IS DECIDED
 *   orientation = wide (w>h) | square (w=h) | tall (w<h)
 *   size        = "s" | "m" | "l" chosen by the admin
 *   The two combine into Tailwind bento spans (6-column grid) so the layout
 *   always stays a tidy bento, whatever mix of ratios is used.
 *
 * HOW TO MODIFY
 *   • Add a ratio preset  → push to ASPECT_PRESETS.
 *   • Change how big the cards get → edit spanForAspect() below.
 * ========================================================================== */

export type AspectSize = "s" | "m" | "l";

export type AspectConfig = {
  /** Preset id such as "16:9", or "custom" when exact pixels are used. */
  ratio: string;
  /** Exact media width in pixels (also drives the ratio when ratio="custom"). */
  width: number;
  /** Exact media height in pixels. */
  height: number;
  /** How much of the bento grid this card claims. */
  size: AspectSize;
};

export type AspectPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  note: string;
};

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: "16:9", label: "16:9 landscape", width: 1920, height: 1080, note: "Standard YouTube video" },
  { id: "9:16", label: "9:16 vertical", width: 1080, height: 1920, note: "Shorts, Reels, TikTok" },
  { id: "4:5", label: "4:5 portrait", width: 1080, height: 1350, note: "Instagram feed post" },
  { id: "1:1", label: "1:1 square", width: 1080, height: 1080, note: "Square post or cover art" },
  { id: "4:3", label: "4:3 classic", width: 1440, height: 1080, note: "Retro / presentation" },
  { id: "21:9", label: "21:9 cinematic", width: 2560, height: 1080, note: "Ultra-wide film look" },
  { id: "3:4", label: "3:4 tall", width: 1080, height: 1440, note: "Poster / print crop" },
];

/** Common export resolutions offered per ratio in the admin dropdown. */
export const RESOLUTION_PRESETS: Record<string, Array<{ label: string; width: number; height: number }>> = {
  "16:9": [
    { label: "1280 x 720 (HD)", width: 1280, height: 720 },
    { label: "1920 x 1080 (Full HD)", width: 1920, height: 1080 },
    { label: "2560 x 1440 (2K)", width: 2560, height: 1440 },
    { label: "3840 x 2160 (4K)", width: 3840, height: 2160 },
  ],
  "9:16": [
    { label: "720 x 1280 (HD vertical)", width: 720, height: 1280 },
    { label: "1080 x 1920 (Full HD vertical)", width: 1080, height: 1920 },
    { label: "1440 x 2560 (2K vertical)", width: 1440, height: 2560 },
  ],
  "4:5": [{ label: "1080 x 1350", width: 1080, height: 1350 }],
  "1:1": [
    { label: "1080 x 1080", width: 1080, height: 1080 },
    { label: "2048 x 2048", width: 2048, height: 2048 },
  ],
  "4:3": [{ label: "1440 x 1080", width: 1440, height: 1080 }],
  "21:9": [{ label: "2560 x 1080", width: 2560, height: 1080 }],
  "3:4": [{ label: "1080 x 1440", width: 1080, height: 1440 }],
};

export const DEFAULT_ASPECT: AspectConfig = { ratio: "16:9", width: 1920, height: 1080, size: "m" };

export const SIZE_LABELS: Record<AspectSize, string> = {
  s: "Small card",
  m: "Medium card",
  l: "Large card (hero)",
};

export function presetById(id: string): AspectPreset | undefined {
  return ASPECT_PRESETS.find((p) => p.id === id);
}

/** Effective pixel box for a config (falls back to the preset). */
export function aspectBox(cfg?: AspectConfig | null): { width: number; height: number } {
  const c = cfg ?? DEFAULT_ASPECT;
  if (c.width > 0 && c.height > 0) return { width: c.width, height: c.height };
  const p = presetById(c.ratio) ?? presetById("16:9")!;
  return { width: p.width, height: p.height };
}

/** CSS `aspect-ratio` value, e.g. "1080 / 1920". */
export function aspectRatioCss(cfg?: AspectConfig | null): string {
  const { width, height } = aspectBox(cfg);
  return `${width} / ${height}`;
}

export type Orientation = "wide" | "square" | "tall";

export function orientationOf(cfg?: AspectConfig | null): Orientation {
  const { width, height } = aspectBox(cfg);
  const r = width / height;
  if (r > 1.05) return "wide";
  if (r < 0.95) return "tall";
  return "square";
}

/**
 * Tailwind bento spans for a card. The public grid is `md:grid-cols-6` with
 * `auto-rows-[minmax(200px,auto)]`, so column spans control width and row
 * spans control height.
 */
export function spanForAspect(cfg?: AspectConfig | null): string {
  const c = cfg ?? DEFAULT_ASPECT;
  const o = orientationOf(c);
  const size = c.size ?? "m";

  if (o === "tall") {
    const cols = size === "l" ? 3 : 2;
    const rows = size === "s" ? 2 : size === "m" ? 3 : 4;
    return `md:col-span-${cols} md:row-span-${rows}`;
  }
  if (o === "square") {
    const cols = size === "s" ? 2 : size === "m" ? 3 : 4;
    const rows = size === "l" ? 3 : 2;
    return `md:col-span-${cols} md:row-span-${rows}`;
  }
  // wide
  const cols = size === "s" ? 2 : size === "m" ? 3 : 6;
  const rows = size === "l" ? 3 : size === "m" ? 2 : 1;
  return `md:col-span-${cols} md:row-span-${rows}`;
}

/**
 * Tailwind cannot see dynamically built class names, so every span string that
 * spanForAspect() can ever produce is listed here once. Keep in sync.
 * md:col-span-2 md:col-span-3 md:col-span-4 md:col-span-6
 * md:row-span-1 md:row-span-2 md:row-span-3 md:row-span-4
 */
export const ASPECT_SPAN_SAFELIST =
  "md:col-span-2 md:col-span-3 md:col-span-4 md:col-span-6 md:row-span-1 md:row-span-2 md:row-span-3 md:row-span-4";

/** Coerce anything (DB JSON, form state) into a valid config. */
export function sanitizeAspect(input: unknown): AspectConfig {
  if (!input || typeof input !== "object") return { ...DEFAULT_ASPECT };
  const r = input as Record<string, unknown>;
  const ratio = typeof r.ratio === "string" && r.ratio ? r.ratio : DEFAULT_ASPECT.ratio;
  const preset = presetById(ratio);
  const width = Number(r.width) > 0 ? Math.round(Number(r.width)) : preset?.width ?? DEFAULT_ASPECT.width;
  const height = Number(r.height) > 0 ? Math.round(Number(r.height)) : preset?.height ?? DEFAULT_ASPECT.height;
  const size: AspectSize = r.size === "s" || r.size === "l" ? r.size : "m";
  return { ratio, width: Math.min(width, 10000), height: Math.min(height, 10000), size };
}

/** Coerce the whole `{ itemId: config }` map. */
export function sanitizeAspectMap(input: unknown): Record<string, AspectConfig> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, AspectConfig> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!k || k.length > 100) continue;
    out[k] = sanitizeAspect(v);
  }
  return out;
}
