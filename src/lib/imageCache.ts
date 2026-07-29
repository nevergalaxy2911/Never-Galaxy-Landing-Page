/* -----------------------------------------------------------------------------
 * imageCache — persist portfolio preview screenshots in localStorage so that a
 * returning visitor sees them paint instantly instead of waiting on a network
 * round-trip (even a 304 revalidation costs a visible beat on slow links).
 *
 * HOW IT WORKS
 *   1. The <img> always renders the real URL first — SSR and the first client
 *      render stay byte-identical, so hydration never mismatches.
 *   2. On mount, `useCachedImage` looks for a stored data URL for that src and
 *      swaps it in synchronously if one exists (instant, zero requests).
 *   3. If nothing is stored, the image is fetched once it has loaded anyway,
 *      converted to a data URL and written to localStorage for next time.
 *
 * SAFETY RAILS (localStorage is a hard ~5MB, synchronous, shared budget)
 *   • MAX_ENTRY_BYTES  — anything bigger than this is never stored.
 *   • MAX_TOTAL_BYTES  — the cache evicts least-recently-used entries to stay
 *                        under this ceiling.
 *   • TTL_MS           — entries older than this are dropped, so a redeployed
 *                        screenshot can never be pinned forever.
 *   • Every read/write is wrapped in try/catch: Safari private mode and
 *     quota-exceeded must degrade to "just use the network", never throw.
 *
 * HOW TO MODIFY
 *   • Cache more/bigger images → raise MAX_ENTRY_BYTES / MAX_TOTAL_BYTES.
 *   • Force everyone to refetch → bump CACHE_VERSION.
 *   • Turn the feature off      → have useCachedImage return `src` immediately.
 * --------------------------------------------------------------------------- */
import { useEffect, useState } from "react";
import { shouldPrefetchHeavyAssets, screenshotTier, isLowEndDevice } from "@/lib/deviceTier";
import { useAutoQualityCap } from "@/lib/autoQuality";

const CACHE_VERSION = "v1";
const KEY_PREFIX = `ng-imgcache-${CACHE_VERSION}:`;
const INDEX_KEY = `ng-imgcache-${CACHE_VERSION}-index`;
const MAX_ENTRY_BYTES = 320 * 1024; // ~320KB of base64 per screenshot
const MAX_TOTAL_BYTES = 2.6 * 1024 * 1024; // stay well under the 5MB budget
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // two weeks

type IndexEntry = { src: string; bytes: number; at: number };

/* -----------------------------------------------------------------------------
 * LIVE STATS (feeds the diagnostics panel)
 *
 * hits    — screenshots that painted straight from localStorage (no request).
 * misses  — screenshots that had to come from the network this session.
 * lastRenderMs / lastRenderedAt — how long the most recent preview screenshot
 *           took to become paintable, and when that happened. Together with the
 *           hit rate this is the number that proves the cache is doing its job.
 *
 * HOW TO MODIFY: call `noteImageRender(ms, cached)` from anywhere that resolves
 * a screenshot; subscribe with `subscribeImageCache` to render the numbers.
 * --------------------------------------------------------------------------- */
export type ImageCacheStats = {
  hits: number;
  misses: number;
  hitRate: number; // 0..1
  entries: number;
  bytes: number;
  budgetBytes: number; // our own self-imposed ceiling (MAX_TOTAL_BYTES)
  quotaBytes: number | null; // browser-reported origin quota, if known
  quotaUsedBytes: number | null; // browser-reported origin usage, if known
  lastRenderMs: number | null;
  lastRenderedAt: number | null;
};

const STATS_EVENT = "ng-imgcache-stats";
let hits = 0;
let misses = 0;
let lastRenderMs: number | null = null;
let lastRenderedAt: number | null = null;

function notifyStats() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STATS_EVENT));
}

/** Record that a screenshot became paintable. `cached` = served from storage. */
export function noteImageRender(ms: number | null, cached: boolean) {
  if (cached) hits++;
  else misses++;
  // A miss passes `null`: the real cost is the network fetch, which is only
  // known once the <img> fires `load` (see noteImageLoaded below).
  if (ms !== null) {
    lastRenderMs = Math.round(ms);
    lastRenderedAt = Date.now();
  }
  notifyStats();
}

/** Called from the <img> onLoad handler with the measured time-to-paint. */
export function noteImageLoaded(ms: number) {
  lastRenderMs = Math.round(ms);
  lastRenderedAt = Date.now();
  notifyStats();
}

/* STORAGE QUOTA — the browser only exposes it asynchronously, so we keep the
 * last reading in module state and refresh it on demand (the diagnostics panel
 * calls refreshStorageEstimate when it opens). Unsupported browsers stay null
 * and the panel simply shows "—".
 * HOW TO MODIFY: call refreshStorageEstimate() anywhere you want fresh numbers. */
let quotaBytes: number | null = null;
let quotaUsedBytes: number | null = null;

export async function refreshStorageEstimate(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
  try {
    const est = await navigator.storage.estimate();
    quotaBytes = typeof est.quota === "number" ? est.quota : null;
    quotaUsedBytes = typeof est.usage === "number" ? est.usage : null;
    notifyStats();
  } catch {
    /* Safari private mode and friends — leave the numbers unknown */
  }
}

/* -----------------------------------------------------------------------------
 * AUTOMATIC QUOTA-PRESSURE EVICTION
 *
 * WHAT: when the ORIGIN as a whole gets close to its storage quota, the cache
 * gives space back instead of waiting for a QuotaExceededError (which would
 * otherwise wipe the whole cache, or break an unrelated feature's write).
 *
 * HOW: after a write we ask the browser for its usage estimate (throttled to
 * once every QUOTA_CHECK_MS). Above QUOTA_PRESSURE the least-recently-used
 * screenshots are dropped until we're back under QUOTA_RELIEF of the quota, or
 * the cache is empty. Screenshots are the most disposable thing we store — they
 * simply re-download — so they are the right thing to sacrifice first.
 *
 * HOW TO MODIFY
 *   • Evict sooner/later     → QUOTA_PRESSURE (0..1 of quota).
 *   • Free more per sweep    → lower QUOTA_RELIEF.
 *   • Check more often       → lower QUOTA_CHECK_MS.
 * --------------------------------------------------------------------------- */
const QUOTA_PRESSURE = 0.8; // start evicting above 80% of the origin quota
const QUOTA_RELIEF = 0.65; // ...and keep going until back under 65%
const QUOTA_CHECK_MS = 15_000;
let lastQuotaCheck = 0;

export async function evictForQuotaPressure(force = false): Promise<number> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return 0;
  const now = Date.now();
  if (!force && now - lastQuotaCheck < QUOTA_CHECK_MS) return 0;
  lastQuotaCheck = now;

  await refreshStorageEstimate();
  if (!quotaBytes || quotaUsedBytes === null) return 0;
  if (quotaUsedBytes / quotaBytes <= QUOTA_PRESSURE) return 0;

  // How many bytes we need to hand back to sit comfortably under the ceiling.
  let need = quotaUsedBytes - quotaBytes * QUOTA_RELIEF;
  let entries = readIndex().sort((a, b) => a.at - b.at); // oldest touch first
  let freed = 0;
  while (need > 0 && entries.length) {
    const oldest = entries[0];
    entries = drop(oldest.src, entries);
    need -= oldest.bytes;
    freed += oldest.bytes;
  }
  writeIndex(entries);
  await refreshStorageEstimate();
  return freed;
}


export function getImageCacheStats(): ImageCacheStats {
  const entries = typeof window === "undefined" ? [] : readIndex();
  const total = hits + misses;
  return {
    hits,
    misses,
    hitRate: total ? hits / total : 0,
    entries: entries.length,
    bytes: entries.reduce((sum, e) => sum + e.bytes, 0),
    budgetBytes: MAX_TOTAL_BYTES,
    quotaBytes,
    quotaUsedBytes,
    lastRenderMs,
    lastRenderedAt,
  };
}

export function subscribeImageCache(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STATS_EVENT, cb);
  return () => window.removeEventListener(STATS_EVENT, cb);
}

function keyFor(src: string) {
  return KEY_PREFIX + src;
}


function readIndex(): IndexEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as IndexEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: IndexEntry[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode */
  }
}

function drop(src: string, entries: IndexEntry[]): IndexEntry[] {
  try {
    localStorage.removeItem(keyFor(src));
  } catch {
    /* ignore */
  }
  memForget(src);
  return entries.filter((e) => e.src !== src);
}


/* -----------------------------------------------------------------------------
 * IN-MEMORY MIRROR (the tab-switch speed fix)
 *
 * WHY: every tile re-mounts when you switch a portfolio filter. Reading each
 * screenshot back out of localStorage on every mount means a synchronous
 * getItem of a ~300KB base64 string PLUS a JSON index rewrite, per tile. With
 * a dozen tiles that is tens of milliseconds of blocked main thread right at
 * the moment the new grid wants to paint, which reads as "the images take a
 * while to show up".
 *
 * FIX: the first read of a src is mirrored into a plain Map. Every later mount
 * (i.e. every filter switch) answers from memory in microseconds, and the LRU
 * "touch" write is throttled so we never rewrite the index in a hot loop.
 *
 * HOW TO MODIFY
 *   • Disable the mirror  → return null from memGet / no-op memSet.
 *   • Touch LRU more often → lower TOUCH_THROTTLE_MS.
 * --------------------------------------------------------------------------- */
const memCache = new Map<string, string | null>();
const TOUCH_THROTTLE_MS = 30_000;
const lastTouched = new Map<string, number>();

/** Drop a src from the in-memory mirror (used when the entry is evicted). */
function memForget(src: string) {
  memCache.delete(src);
  lastTouched.delete(src);
}

/** Read a stored data URL, dropping it if it has expired. */
export function readCachedImage(src: string): string | null {
  if (typeof window === "undefined") return null;
  // FAST PATH — answered from memory, no localStorage, no JSON parsing.
  const mirrored = memCache.get(src);
  if (mirrored !== undefined) {
    const now = Date.now();
    if (mirrored && now - (lastTouched.get(src) ?? 0) > TOUCH_THROTTLE_MS) {
      lastTouched.set(src, now);
      // LRU touch deferred off the paint path.
      whenIdle(() => touchEntry(src), 2000);
    }
    return mirrored;
  }
  try {
    const value = localStorage.getItem(keyFor(src));
    if (!value) {
      memCache.set(src, null);
      return null;
    }
    const entries = readIndex();
    const entry = entries.find((e) => e.src === src);
    if (!entry || Date.now() - entry.at > TTL_MS) {
      writeIndex(drop(src, entries));
      memCache.set(src, null);
      return null;
    }
    // Touch the entry so LRU eviction keeps the images people actually see.
    entry.at = Date.now();
    writeIndex(entries);
    memCache.set(src, value);
    lastTouched.set(src, Date.now());
    return value;
  } catch {
    return null;
  }
}

/** Bump the LRU timestamp for a src without re-reading the payload. */
function touchEntry(src: string) {
  try {
    const entries = readIndex();
    const entry = entries.find((e) => e.src === src);
    if (!entry) return;
    entry.at = Date.now();
    writeIndex(entries);
  } catch {
    /* private mode / quota */
  }
}


/** Store a data URL, evicting least-recently-used entries to make room. */
export function writeCachedImage(src: string, dataUrl: string) {
  if (typeof window === "undefined") return;
  const bytes = dataUrl.length;
  if (bytes > MAX_ENTRY_BYTES) return; // too heavy to be worth a localStorage slot
  try {
    let entries = drop(src, readIndex());
    entries.push({ src, bytes, at: Date.now() });
    // LRU eviction: oldest touch goes first until we're back under budget.
    entries.sort((a, b) => a.at - b.at);
    let total = entries.reduce((sum, e) => sum + e.bytes, 0);
    while (total > MAX_TOTAL_BYTES && entries.length > 1) {
      const oldest = entries[0];
      entries = drop(oldest.src, entries);
      total -= oldest.bytes;
    }
    localStorage.setItem(keyFor(src), dataUrl);
    writeIndex(entries);
    // Keep the in-memory mirror in sync so the next mount is instant.
    memCache.set(src, dataUrl);
    lastTouched.set(src, Date.now());

  } catch {
    // Quota exceeded → wipe the cache rather than leaving it half-written.
    clearImageCache();
  }
}

/** Nuke every cached screenshot (used on quota errors and by the admin panel). */
export function clearImageCache() {
  if (typeof window === "undefined") return;
  try {
    readIndex().forEach((e) => localStorage.removeItem(keyFor(e.src)));
    localStorage.removeItem(INDEX_KEY);
  } catch {
    /* ignore */
  }
  memCache.clear();
  lastTouched.clear();

  hits = 0;
  misses = 0;
  lastRenderMs = null;
  lastRenderedAt = null;
  notifyStats();
}

/** Fetch an image and persist it as a data URL. Failures are silent. */
async function cacheImage(src: string) {
  try {
    const res = await fetch(src, { cache: "force-cache" });
    if (!res.ok) return;
    const blob = await res.blob();
    if (blob.size > MAX_ENTRY_BYTES * 0.72) return; // base64 inflates by ~4/3
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    writeCachedImage(src, dataUrl);
    // Give space back before the browser starts refusing writes (throttled).
    void evictForQuotaPressure();

  } catch {
    /* offline, CORS, whatever — the network copy still works */
  }
}

/** Run `fn` when the main thread is idle (with a timeout fallback). */
function whenIdle(fn: () => void, timeout = 1500): () => void {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (h: number) => void;
  };
  if (w.requestIdleCallback) {
    const h = w.requestIdleCallback(fn, { timeout });
    return () => w.cancelIdleCallback?.(h);
  }
  const h = window.setTimeout(fn, timeout);
  return () => window.clearTimeout(h);
}

/* -----------------------------------------------------------------------------
 * IDLE WARM-UP
 * Pull every portfolio screenshot into the cache while the browser is idle, one
 * at a time so the warm-up can never compete with the page's own paints. After
 * this runs once, opening the Website tab is instant on the very same visit.
 *
 * HOW TO MODIFY: pass fewer URLs, or raise the delay between fetches below.
 * --------------------------------------------------------------------------- */
export function warmImageCache(srcs: Array<string | undefined>): () => void {
  if (typeof window === "undefined") return () => {};
  // Low-end phones and Data Saver connections skip the warm-up entirely: the
  // tiles still load normally, they just don't pay for speculative fetches.
  if (!shouldPrefetchHeavyAssets()) return () => {};
  const queue = srcs.filter((s): s is string => !!s && !s.startsWith("data:"));
  let cancelled = false;
  let cancelIdle: () => void = () => {};

  const step = () => {
    if (cancelled) return;
    const next = queue.shift();
    if (!next) return;
    if (readCachedImage(next)) {
      cancelIdle = whenIdle(step, 200);
      return;
    }
    void cacheImage(next).then(() => {
      if (!cancelled) cancelIdle = whenIdle(step, 400);
    });
  };
  cancelIdle = whenIdle(step, 2000);

  return () => {
    cancelled = true;
    cancelIdle();
  };
}

/* -----------------------------------------------------------------------------
 * IMMEDIATE WARM-UP ("Warm preview cache now")
 *
 * WHAT: same job as warmImageCache, but it does NOT wait for browser idle time
 * and it does NOT skip low-end / Data-Saver devices — the visitor explicitly
 * asked for it from the Experience menu, so we honour the request.
 *
 * HOW: fetches in small parallel batches (CONCURRENCY) so a handful of
 * screenshots land in a second or two without saturating the connection.
 *
 * RETURNS: { total, alreadyCached, fetched } so the UI can report what it did.
 *
 * HOW TO MODIFY: raise CONCURRENCY for faster (but heavier) warm-ups.
 * --------------------------------------------------------------------------- */
const WARM_CONCURRENCY = 3;

export async function warmImageCacheNow(
  srcs: Array<string | undefined>,
): Promise<{ total: number; alreadyCached: number; fetched: number }> {
  if (typeof window === "undefined") return { total: 0, alreadyCached: 0, fetched: 0 };
  const queue = Array.from(
    new Set(srcs.filter((s): s is string => !!s && !s.startsWith("data:"))),
  );
  let alreadyCached = 0;
  let fetched = 0;

  const pending = [...queue];
  const worker = async () => {
    for (;;) {
      const next = pending.shift();
      if (!next) return;
      if (readCachedImage(next)) {
        alreadyCached++;
        continue;
      }
      await cacheImage(next);
      fetched++;
    }
  };
  await Promise.all(Array.from({ length: WARM_CONCURRENCY }, worker));
  notifyStats();
  return { total: queue.length, alreadyCached, fetched };
}


/**
 * Returns the best available source for `src`:
 *   • the cached data URL when one exists (instant paint, no request),
 *   • otherwise `src` itself — and schedules a background cache write.
 *
 * SSR-safe: the first render always returns `src`.
 */
/* HYDRATION FLAG — the very first client render must match the server output
 * byte for byte, so it always uses the plain URL. Every mount AFTER hydration
 * (switching a portfolio filter, for example) is free to resolve the cached
 * data URL synchronously, which is what makes the new tiles paint on the same
 * frame instead of one render later. */
let hydrated = false;

export function useCachedImage(src?: string): string | undefined {
  const [resolved, setResolved] = useState(() =>
    hydrated && src && !src.startsWith("data:") ? (readCachedImage(src) ?? src) : src,
  );

  useEffect(() => {
    hydrated = true;
    if (!src || src.startsWith("data:")) {
      setResolved(src);
      return;
    }
    const started = performance.now();
    const hit = readCachedImage(src);
    if (hit) {
      setResolved(hit);
      noteImageRender(performance.now() - started, true);
      return;
    }
    setResolved(src);
    noteImageRender(null, false);
    // Warm the cache when the browser is idle so it never competes with paint.
    return whenIdle(() => void cacheImage(src), 1200);
  }, [src]);

  return resolved;
}



/* -----------------------------------------------------------------------------
 * PROGRESSIVE LOADING (low-res first, then refine)
 *
 * WHAT: `useProgressiveImage` returns the small mobile screenshot immediately
 * and swaps in the full-resolution desktop shot only once that has finished
 * decoding in the background. The visitor sees *something* almost instantly,
 * and the upgrade is invisible because it happens off-screen before the swap.
 *
 * ADAPTIVE: on Data Saver / low-end devices (screenshotTier() === "low") the
 * refinement step is skipped entirely — the small shot IS the final image, so
 * those devices never pay to download or GPU-upload the big one.
 *
 * RETURNS
 *   src        — what to put in <img src>
 *   isFinal    — true once the high-res (or the only) image is showing
 *   isCached   — the shown source came from localStorage (zero network)
 *
 * USER SETTINGS (Experience menu → both persist to localStorage)
 *   • "Progressive previews" (ng-progressive-img) — off means no low-res step:
 *     the tile waits for the image that device is going to keep.
 *   • "Cap quality on low-end" (ng-cap-preview-quality) — on (default) keeps
 *     weak/Data-Saver devices on the small shot forever; off forces full
 *     resolution everywhere.
 *
 * HOW TO MODIFY
 *   • Always load full-res → default capPreviewQualityPref to false.
 *   • Disable progression  → default progressiveImagesPref to false.
 * --------------------------------------------------------------------------- */
/* DECODED REGISTRY — every screenshot the browser has already decoded during
 * this page session. Used to skip the blur-up step on later mounts. */
const decodedSrcs = new Set<string>();
function isDecoded(src?: string) {
  return Boolean(src && decodedSrcs.has(src));
}
function noteDecoded(src?: string) {
  if (src) decodedSrcs.add(src);
}
/** Public marker: call after a src has finished decoding off-screen so tiles
 *  mounted later skip the low-res step entirely. */
export function markImageDecoded(src?: string) {
  noteDecoded(src);
}

export function useProgressiveImage(

  highSrc?: string,
  lowSrc?: string,
): { src?: string; isFinal: boolean; isCached: boolean } {
  const cachedHigh = useCachedImage(highSrc);
  const cachedLow = useCachedImage(lowSrc);
  // Progressive loading is always on. The quality cap is automatic: the FPS
  // watchdog (lib/autoQuality.ts) trips it as soon as the page stutters.
  const autoCapped = useAutoQualityCap();
  /* ALREADY-DECODED SHORTCUT — if this exact image was decoded earlier in the
     session (portfolio warm-up, or a previous visit to this filter tab) the
     blurry low-res step is pure delay, so we start out already refined. This
     is what makes flicking between filter pills paint the sharp shot at once.
     HOW TO MODIFY: clear `decodedSrcs` to force the blur-up step back on. */
  const [refined, setRefined] = useState(() => isDecoded(cachedHigh));
  const [lowOnly, setLowOnly] = useState(false);
  // SMALL / LOW-END DEVICES: the Experience menu hides these two switches there
  // (see EffectsMenu), so the runtime hard-codes the cheapest behaviour instead
  // of honouring whatever a desktop session happened to store.
  const [forceLight, setForceLight] = useState(false);
  useEffect(() => {
    setForceLight(isLowEndDevice());
  }, []);
  const progressive = true;
  const capQuality = forceLight || autoCapped;

  // Decide the tier on the client only, so SSR output stays deterministic.
  useEffect(() => {
    setLowOnly(lowSrc && capQuality ? screenshotTier() === "low" : false);
  }, [lowSrc, capQuality]);


  // Preload (and decode) the full-resolution shot off-screen, then swap.
  useEffect(() => {
    if (!cachedHigh || lowOnly || !lowSrc || !progressive) {
      setRefined(false);
      return;
    }
    if (cachedHigh.startsWith("data:") || isDecoded(cachedHigh)) {
      // Already on-device or already decoded this session: show it straight away.
      noteDecoded(cachedHigh);
      setRefined(true);
      return;
    }
    setRefined(false);
    let alive = true;
    const img = new Image();
    img.decoding = "async";
    img.src = cachedHigh;
    const done = () => {
      noteDecoded(cachedHigh);
      if (alive) setRefined(true);
    };
    if (img.decode) img.decode().then(done, done);
    else {
      img.onload = done;
      img.onerror = done;
    }
    return () => {
      alive = false;
    };
  }, [cachedHigh, lowOnly, lowSrc, progressive]);


  // With progression off we never show the intermediate low-res step; the tile
  // shows the final image for this device (small if capped, sharp otherwise).
  const useLow = Boolean(lowSrc) && (lowOnly || (progressive && !refined));

  const src = useLow ? (cachedLow ?? cachedHigh) : cachedHigh;
  return {
    src,
    isFinal: !useLow || lowOnly,
    isCached: Boolean(src?.startsWith("data:")),
  };
}
