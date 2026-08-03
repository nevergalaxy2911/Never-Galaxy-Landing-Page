/**
 * Small pure helpers used by analytics server functions.
 *
 * WHY A SEPARATE FILE: modules that declare `createServerFn` are split by the
 * bundler and only handler bodies survive on the server, so any runtime helper
 * living beside them can vanish. Keep helpers here and import them.
 */

/** Pull a readable hostname out of a referrer URL, falling back to raw text. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 60);
  }
}
