/* ============================================================================
 * ADBLOCK OVERRIDE — admin/user/environment kill switch for the gate
 * ----------------------------------------------------------------------------
 * WHY:
 *   Detectors sometimes disagree (corp proxy vs Brave vs uBO vs regional
 *   CDN). We need a first-class way to silence or force the widget for
 *   specific accounts, environments, or one-off debugging without editing
 *   code or shipping a build.
 *
 * PRECEDENCE (highest first):
 *   1. Env kill switch:            VITE_ADBLOCK_DISABLE=1 → gate never runs.
 *   2. URL query param:            ?ng_adblock=off | force | auto
 *   3. localStorage user setting:  ng_adblock_override = off | force | auto
 *   4. Default:                    auto  (normal detection)
 *
 *   "off"   → gate is disabled; detection never runs.
 *   "force" → gate is shown immediately; detection is skipped.
 *   "auto"  → normal probe + classify flow.
 *
 * URL param writes-through to localStorage so a single link (given to a
 * beta user, support case, or admin account) sticks across page loads.
 * ========================================================================== */

export type OverrideMode = "auto" | "off" | "force";
const STORAGE_KEY = "ng_adblock_override";
const URL_PARAM = "ng_adblock";

function envDisabled(): boolean {
  try {
    return (import.meta as { env?: Record<string, string | undefined> }).env
      ?.VITE_ADBLOCK_DISABLE === "1";
  } catch {
    return false;
  }
}

function parseMode(value: string | null | undefined): OverrideMode | null {
  if (value === "off" || value === "force" || value === "auto") return value;
  return null;
}

export function readOverride(): OverrideMode {
  if (typeof window === "undefined") return "auto";
  if (envDisabled()) return "off";

  try {
    const url = new URL(window.location.href);
    const fromUrl = parseMode(url.searchParams.get(URL_PARAM));
    if (fromUrl) {
      try {
        window.localStorage.setItem(STORAGE_KEY, fromUrl);
      } catch {
        /* ignore quota / disabled storage */
      }
      // Clean the URL so shared links don't carry the override forever.
      url.searchParams.delete(URL_PARAM);
      window.history.replaceState(window.history.state, "", url.toString());
      return fromUrl;
    }
  } catch {
    /* ignore */
  }

  try {
    return parseMode(window.localStorage.getItem(STORAGE_KEY)) ?? "auto";
  } catch {
    return "auto";
  }
}

export function setOverride(mode: OverrideMode) {
  if (typeof window === "undefined") return;
  try {
    if (mode === "auto") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}
