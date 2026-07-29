/* -----------------------------------------------------------------------------
 * audioCache — persist the ambient music track locally so it only ever
 * downloads once, then plays instantly on every future visit.
 *
 * WHY NOT localStorage: localStorage is a ~5MB *string* store and the track is
 * ~1.5MB of binary, which becomes ~2MB once base64-encoded — that would eat
 * almost the entire budget the portfolio screenshot cache also lives in.
 * The Cache Storage API is the browser's purpose-built binary store: same
 * "saved on the device, no network next time" behaviour, no size pressure.
 *
 * FALLBACK ORDER
 *   1. Cache Storage  (all modern browsers, survives reloads and restarts)
 *   2. plain fetch    (private mode / Cache Storage disabled)
 *
 * HOW TO MODIFY
 *   • Swap the track      → change AMBIENCE_URL where this is called
 *     (src/lib/soundEngine.ts imports the asset pointer).
 *   • Force a re-download → bump CACHE_NAME.
 *   • Clear it            → call clearAudioCache() (wired to the Experience
 *     menu's "Clear preview cache" button).
 * --------------------------------------------------------------------------- */

const CACHE_NAME = "ng-audio-v1";

/** Fetch a media URL, preferring the on-device copy. Returns raw bytes. */
export async function fetchCachedAudio(url: string): Promise<ArrayBuffer> {
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) return await hit.arrayBuffer();
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) throw new Error(`audio ${res.status}`);
      // Clone before reading: a Response body can only be consumed once.
      try {
        await cache.put(url, res.clone());
      } catch {
        /* quota / opaque response — playing it is still fine */
      }
      return await res.arrayBuffer();
    } catch {
      /* fall through to the plain network path */
    }
  }
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`audio ${res.status}`);
  return await res.arrayBuffer();
}

/** True when the track is already stored on this device. */
export async function isAudioCached(url: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    return Boolean(await cache.match(url));
  } catch {
    return false;
  }
}

/** Remove the stored track (used by the "Clear preview cache" button). */
export async function clearAudioCache() {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    /* ignore */
  }
}
