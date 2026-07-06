import { useEffect, useState, useCallback, useRef } from "react";
import { adblockLog, AdblockDebugOverlay } from "@/lib/adblockDebug";
import { classify, type DetectionSignals } from "@/lib/adblockPolicy";
import { readOverride } from "@/lib/adblockOverride";

/* ============================================================================
 * ADBLOCK GATE — free, no-API adblock detector + friendly full-screen overlay
 * ----------------------------------------------------------------------------
 * WHY:
 *   Ad/tracker blockers (uBlock, AdBlock, Brave Shields, Pi-hole) frequently
 *   break the YouTube <iframe> embeds used in the Portfolio → Work section.
 *   We show no ads on this site, so we ask visitors to disable their blocker
 *   before they can enter — purely to keep the video player working.
 *
 * HOW IT WORKS (strict, fail-closed signals):
 *   1) BAIT ELEMENT: Insert a hidden <div> whose classnames match ad-related
 *      selectors in the biggest blocklists ("ad-banner", "adsbox",
 *      "ads-container", "sponsored"). Blockers hide it → offsetHeight/parent
 *      becomes 0/null.
 *   2) BAIT SCRIPT + GLOBAL CHECK: Load pagead2 adsbygoogle.js as a <script>.
 *      Naive detectors just listen for onerror — that MISSES BRAVE, because
 *      Brave Shields replaces the response with an empty 200 (onload fires
 *      normally). We defeat that by checking `window.adsbygoogle` after
 *      onload — the real SDK defines it, an empty replacement doesn't.
 *   3) EXTRA BRAVE CANARIES: Load Google Publisher Tag + IMA SDK canaries.
 *      Brave Shields may let one bait slip depending on cache/list updates,
 *      so we test multiple ad/video-ad endpoints and require all to behave
 *      like real scripts.
 *   4) BAIT FETCH: Fetch the same URL and inspect the payload size. Brave
 *      often returns 200 with 0 bytes; a real load is tens of KB. Also catches
 *      pure network blockers (uBO, Pi-hole) which throw TypeError.
 *   5) BRAVE DETECTION: `navigator.brave?.isBrave()` — first-party API.
 *      Used for diagnostics; Shields state itself is intentionally not exposed.
 *
 * Strict mode means ANY failed signal blocks. While the check is running, the
 * overlay is already visible, so visitors cannot enter during async detection.
 *
 * FREE + NO API + NO KEY + NO NPM PACKAGE. 100% client-side.
 *
 * UX:
 *   • Overlay is a fixed, top-layer modal (z-index high, blocks scroll+clicks).
 *   • "I've turned it off — check again" button reloads into a slower,
 *     one-shot verification path so Brave has time to release old Shields
 *     decisions before we judge the browser clean/blocked.
 *   • Passes are not stored. Every load and every re-check probes from scratch.
 *   • Respects `prefers-reduced-motion` (no animations for those users).
 *
 * HOW TO MODIFY:
 *   • Disable entirely: remove <AdblockGate /> from src/routes/index.tsx.
 *   • Change copy: edit the JSX at the bottom of this file.
 * ========================================================================== */

const BAIT_SCRIPT_URL =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
const GPT_SCRIPT_URL = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
const IMA_SCRIPT_URL = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
const MANUAL_RECHECK_PARAM = "ng_adblock_recheck";
const NORMAL_CHECK_DELAY_MS = 700;
const MANUAL_RECHECK_DELAY_MS = 1_600;
const FOCUS_RECHECK_COOLDOWN_MS = 3_000;
const DEFAULT_BLOCK_RETRY_DELAYS_MS = [900];
const MANUAL_BLOCK_RETRY_DELAYS_MS = [1_000, 1_600];
// When the tab regains focus after being backgrounded, the browser may serve
// stale/cached "empty" ad-script responses for a beat even though the blocker
// is off. Use a patient retry pattern + settle delay so we don't false-flag.
const FOCUS_BLOCK_RETRY_DELAYS_MS = [1_000, 1_600, 2_200];
const FOCUS_RECHECK_SETTLE_MS = 800;

// -------- Env-configurable self-repair thresholds --------------------------
// Tune these without editing code by setting Vite env vars (`.env.local` or
// build env). Fall back to safe defaults if unset or unparsable.
//
//   VITE_ADBLOCK_ENFORCE_WINDOW_MS       (default 500)  — rolling window
//   VITE_ADBLOCK_ENFORCE_ESCALATE_AT     (default 12)   — hits in window → re-mount
//   VITE_ADBLOCK_SWEEP_INTERVAL_MS       (default 1000) — DOM-presence sweep
//   VITE_ADBLOCK_TAMPER_DISABLE          ("1" disables the tamper watchdog)
function envNumber(name: string, fallback: number): number {
  try {
    const raw = (import.meta as { env?: Record<string, string | undefined> }).env?.[name];
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}
function envFlag(name: string): boolean {
  try {
    return (import.meta as { env?: Record<string, string | undefined> }).env?.[name] === "1";
  } catch {
    return false;
  }
}
const ENFORCE_WINDOW_MS = envNumber("VITE_ADBLOCK_ENFORCE_WINDOW_MS", 500);
const ENFORCE_ESCALATE_AT = envNumber("VITE_ADBLOCK_ENFORCE_ESCALATE_AT", 12);
const SWEEP_INTERVAL_MS = envNumber("VITE_ADBLOCK_SWEEP_INTERVAL_MS", 1000);
const TAMPER_DISABLED = envFlag("VITE_ADBLOCK_TAMPER_DISABLE");

type Result = "blocked" | "clear";

// DetectionSignals is imported from @/lib/adblockPolicy (shared with the
// server diagnostics endpoint so both sides classify identically).

type WindowWithAdGlobals = {
  adsbygoogle?: unknown;
  googletag?: unknown;
  google?: { ima?: unknown };
};

type AdGlobalKey = "adsbygoogle" | "googletag" | "google";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function probeNonce(): string {
  // Date-only cache busters can collide across fast reload/focus checks.
  // Random nonces make every canary URL unique, including the manual Brave
  // recheck path immediately after Shields are toggled off.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function withCacheBuster(src: string): string {
  return src + (src.includes("?") ? "&" : "?") + "_=" + probeNonce();
}

function consumeManualRecheckFlag(): boolean {
  // This is NOT a pass/bypass cache. It is a one-shot reload marker that only
  // makes the next check slower and more patient after a user disables Brave
  // Shields, because Brave can briefly report stale blocked canary responses.
  const url = new URL(window.location.href);
  const hasFlag = url.searchParams.has(MANUAL_RECHECK_PARAM);
  if (!hasFlag) return false;
  url.searchParams.delete(MANUAL_RECHECK_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
  return true;
}

function reloadForManualRecheck() {
  const url = new URL(window.location.href);
  url.searchParams.set(MANUAL_RECHECK_PARAM, probeNonce());
  window.location.replace(url.toString());
}

async function detectBrave(): Promise<boolean> {
  // Brave exposes navigator.brave.isBrave() — returns a Promise<boolean>.
  const nav = navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } };
  try {
    return (await nav.brave?.isBrave?.()) === true;
  } catch {
    return false;
  }
}

function baitElementBlocked(): boolean {
  const bait = document.createElement("div");
  bait.className =
    "ad-banner adsbox ads ad ads-container sponsored google-ads pub_300x250 adsbygoogle";
  bait.setAttribute("aria-hidden", "true");
  bait.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none;";
  document.body.appendChild(bait);
  // Force sync layout so we can read box metrics without waiting a frame.
  const rect = bait.getBoundingClientRect();
  const cs = getComputedStyle(bait);
  const blocked =
    !bait.offsetParent ||
    bait.offsetHeight === 0 ||
    bait.clientHeight === 0 ||
    rect.height === 0 ||
    cs.display === "none" ||
    cs.visibility === "hidden";
  bait.remove();
  return blocked;
}

function clearWindowGlobal(key: AdGlobalKey) {
  const w = window as unknown as WindowWithAdGlobals;
  try {
    delete w[key];
  } catch {
    w[key] = undefined;
  }
}

function baitScriptBlocked(): Promise<boolean> {
  // NOTE ON BRAVE SHIELDS:
  //   Brave doesn't error on blocked ad scripts — it silently replaces the
  //   response with an empty 200. So `<script>.onerror` never fires and
  //   `fetch()` returns an opaque response that "looks" fine. Same trick
  //   catches naive detectors (including the popular `adblock-detector` npm).
  //
  //   Real defense: after we THINK the script loaded, verify it actually
  //   did what adsbygoogle.js does — define `window.adsbygoogle` as an
  //   Array (the SDK pushes ad slots onto it). If that global is missing
  //   after onload, Brave replaced the payload → blocked.
  clearWindowGlobal("adsbygoogle");
  return new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = withCacheBuster(BAIT_SCRIPT_URL);
    s.async = true;
    let done = false;
    const finish = (blocked: boolean) => {
      if (done) return;
      done = true;
      s.remove();
      resolve(blocked);
    };
    s.onload = () => {
      // Give the script a tick to run its IIFE.
      setTimeout(() => {
        const w = window as unknown as WindowWithAdGlobals;
        const hasGlobal =
          Array.isArray(w.adsbygoogle) ||
          (typeof w.adsbygoogle === "object" && w.adsbygoogle !== null);
        // onload fired but global missing → Brave/Shields empty-response trick.
        finish(!hasGlobal);
      }, 50);
    };
    s.onerror = () => finish(true);
    document.head.appendChild(s);
    // Safety timeout — some networks stall; treat stall as "unknown/blocked".
    window.setTimeout(() => finish(true), 2500);
  });
}

function scriptCanaryBlocked({
  src,
  reset,
  hasRealGlobal,
}: {
  src: string;
  reset: () => void;
  hasRealGlobal: () => boolean;
}): Promise<boolean> {
  // Generic canary loader. Brave can occasionally let one ad URL through
  // after a Shields toggle or cache warm-up, so we use multiple independent
  // ad/video-ad scripts and verify each one actually created its known global.
  reset();
  return new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = withCacheBuster(src);
    s.async = true;
    let done = false;
    const finish = (blocked: boolean) => {
      if (done) return;
      done = true;
      s.remove();
      resolve(blocked);
    };
    s.onload = () => {
      window.setTimeout(() => finish(!hasRealGlobal()), 120);
    };
    s.onerror = () => finish(true);
    document.head.appendChild(s);
    window.setTimeout(() => finish(true), 3000);
  });
}

function gptCanaryBlocked(): Promise<boolean> {
  return scriptCanaryBlocked({
    src: GPT_SCRIPT_URL,
    reset: () => clearWindowGlobal("googletag"),
    hasRealGlobal: () => {
      const w = window as unknown as WindowWithAdGlobals;
      return typeof w.googletag === "object" && w.googletag !== null;
    },
  });
}

function imaCanaryBlocked(): Promise<boolean> {
  return scriptCanaryBlocked({
    src: IMA_SCRIPT_URL,
    reset: () => {
      const w = window as unknown as WindowWithAdGlobals;
      if (w.google && "ima" in w.google) {
        try {
          delete w.google.ima;
        } catch {
          w.google.ima = undefined;
        }
      }
    },
    hasRealGlobal: () => {
      const w = window as unknown as WindowWithAdGlobals;
      return typeof w.google?.ima === "object" && w.google.ima !== null;
    },
  });
}

async function baitFetchBlocked(): Promise<boolean> {
  // Second Brave-aware check: fetch the same URL and inspect the payload
  // size. Brave/Shields returns 200 with 0 bytes; a real load is > 10 KB.
  // Wrapped in try/catch because pure network blockers (uBO, Pi-hole) throw
  // TypeError on the fetch itself — which is also "blocked".
  try {
    const res = await fetch(withCacheBuster(BAIT_SCRIPT_URL), {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
    });
    if (!res.ok) return true;
    const text = await res.text();
    // Real adsbygoogle.js is tens of KB. Brave's empty replacement is 0.
    return text.length < 500;
  } catch {
    return true;
  }
}

// Classifier moved to src/lib/adblockPolicy so the /api/public/adblock-diagnostics
// endpoint applies the exact same quorum rule. Rules (any is sufficient):
//   1. DOM cosmetic filter hit
//   2. Brave AND (fetchBlocked OR ≥2 network failures)
//   3. ≥3 network probes fail together (network quorum)

// Brave detection is stable per page load — cache the promise so focus
// rechecks and initial detection don't hit navigator.brave twice.
let braveOnce: Promise<boolean> | null = null;
function braveCached(): Promise<boolean> {
  if (!braveOnce) braveOnce = detectBrave();
  return braveOnce;
}

async function runSingleAdblockDetection(): Promise<Result> {
  // Two rAFs let the browser paint the current frame before we saturate the
  // network with canary requests — keeps LCP snappy on initial mount.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // OPTION A FAST-PATH (silences Lighthouse "errors-in-console" for the 95%+
  // of visitors with no blocker): every major blocker (uBO, ABP, Adblock,
  // Ghostery, AdGuard) applies cosmetic filters to the bait class list, and
  // Brave is detectable directly via navigator.brave. If BOTH those pure-JS,
  // zero-network probes are clean, we skip the ad-SDK <script>/fetch canaries
  // entirely — no blocked pagead2/doubleclick network errors show up in the
  // console. Detection posture is unchanged: any blocker that filters cosmetic
  // classes still trips; Brave still trips; anything that lets both through
  // AND blocks nothing else was never a blocker for THIS site to begin with.
  const [domBlockedFast, isBraveFast] = await Promise.all([
    Promise.resolve(baitElementBlocked()),
    braveCached(),
  ]);
  if (!domBlockedFast && !isBraveFast) {
    adblockLog("detect", "fast-path clear (dom+brave clean)", {
      domBlocked: false,
      isBrave: false,
    });
    return "clear";
  }

  // Use allSettled so a single rejected probe (e.g. an aborted fetch during
  // page unload) never bubbles up and kills the whole detection pass.
  const settled = await Promise.allSettled([
    Promise.resolve(domBlockedFast),
    baitScriptBlocked(),
    gptCanaryBlocked(),
    imaCanaryBlocked(),
    baitFetchBlocked(),
    Promise.resolve(isBraveFast),
  ]);
  const [domBlocked, scriptBlocked, gptBlocked, imaBlocked, fetchBlocked, isBrave] = settled.map(
    (s) => (s.status === "fulfilled" ? Boolean(s.value) : true),
  ) as [boolean, boolean, boolean, boolean, boolean, boolean];

  const signals: DetectionSignals = {
    domBlocked, scriptBlocked, gptBlocked, imaBlocked, fetchBlocked, isBrave,
  };
  const { verdict, reasons } = classify(signals);
  adblockLog("detect", "classified signals", { ...signals, verdict, reasons });
  return verdict;
}



async function detectAdblock(retryDelaysMs: number[] = []): Promise<Result> {
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    const result = await runSingleAdblockDetection();
    if (result === "clear" || attempt === retryDelaysMs.length) return result;
    await wait(retryDelaysMs[attempt]);
  }
  return "blocked";
}

export function AdblockGate() {
  const [result, setResult] = useState<Result>("clear");
  // Start hidden. The check runs silently in the background on mount and only
  // reveals the overlay if a blocker is actually confirmed. A manual recheck
  // reload (after the user says "I've turned it off") is the one exception —
  // there we do show the "Checking…" state so the click has visible feedback.
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const activeCheckRef = useRef<Promise<void> | null>(null);
  const latestCheckIdRef = useRef(0);
  const lastAppliedCheckAtRef = useRef(0);
  const focusRechecksReadyRef = useRef(false);
  const gateRootRef = useRef<HTMLDivElement | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  const runCheck = useCallback(async ({
    force = false,
    retryDelaysMs = DEFAULT_BLOCK_RETRY_DELAYS_MS,
    silent = false,
  }: {
    force?: boolean;
    retryDelaysMs?: number[];
    // silent=true means "don't flash the overlay while probing". Used by the
    // focus/visibility recheck so returning to the tab with a clean browser
    // doesn't briefly show the gate before disappearing.
    silent?: boolean;
  } = {}) => {
    if (!force) {
      if (activeCheckRef.current) return activeCheckRef.current;
      if (Date.now() - lastAppliedCheckAtRef.current < FOCUS_RECHECK_COOLDOWN_MS) return;
    }

    const checkId = latestCheckIdRef.current + 1;
    latestCheckIdRef.current = checkId;

    if (!silent) {
      // Fail closed during every probe, including tab-focus re-checks after
      // someone toggles Brave Shields from the browser chrome.
      setVisible(true);
      setChecking(true);
    }

    const checkPromise = (async () => {
      const startedAt = Date.now();
      adblockLog("check", "start", { checkId, silent, retryDelaysMs });
      try {
        const r = await detectAdblock(retryDelaysMs);
        if (latestCheckIdRef.current !== checkId) {
          adblockLog("check", "stale result dropped", { checkId, r });
          return;
        }
        setResult(r);
        setVisible(r !== "clear");
        setChecking(false);
        lastAppliedCheckAtRef.current = Date.now();
        adblockLog("check", "done", { checkId, r, ms: Date.now() - startedAt });
      } finally {
        if (latestCheckIdRef.current === checkId) activeCheckRef.current = null;
      }
    })();

    activeCheckRef.current = checkPromise;
    return checkPromise;
    // NOTE: we intentionally do NOT persist a "pass" flag anywhere.
    // Every full page load re-runs the check, so a user who passed once
    // and then turned their blocker back on gets caught on the next refresh.
  }, []);

  useEffect(() => {
    // Admin/user/env override precedence: env kill switch → URL param →
    // localStorage → default auto. See src/lib/adblockOverride.ts.
    const override = readOverride();
    if (override === "off") {
      adblockLog("override", "gate disabled by override");
      focusRechecksReadyRef.current = false;
      return;
    }
    if (override === "force") {
      adblockLog("override", "gate forced on by override");
      setResult("blocked");
      setVisible(true);
      setChecking(false);
      focusRechecksReadyRef.current = false;
      return;
    }
    // Run on every mount — no localStorage/sessionStorage pass bypass. Manual
    // reloads get a longer settling delay + extra retry because Brave can keep
    // stale Shields decisions alive for a moment after the lion is turned off.
    const manualRecheck = consumeManualRecheckFlag();
    const t = window.setTimeout(() => {
      void runCheck({
        force: true,
        retryDelaysMs: manualRecheck
          ? MANUAL_BLOCK_RETRY_DELAYS_MS
          : DEFAULT_BLOCK_RETRY_DELAYS_MS,
        // Always silent — the gate stays hidden until we CONFIRM a blocker.
        // No "Checking browser" flash on initial load or after a manual reload;
        // we never want to interrupt visitors who don't have an ad blocker on.
        silent: true,
      }).finally(() => {
        focusRechecksReadyRef.current = true;
      });
    }, manualRecheck ? MANUAL_RECHECK_DELAY_MS : NORMAL_CHECK_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [runCheck]);

  useEffect(() => {
    // Re-check after focus/visibility changes because Brave Shields can be
    // toggled from the browser UI without a clean app remount. Use a patient
    // retry pattern here: after a tab has been backgrounded, ad-script probes
    // can briefly return stale/cached empty responses even with the blocker
    // off, so we settle for a moment and retry a few times before deciding.
    let settleTimer: number | undefined;
    const recheck = () => {
      if (!focusRechecksReadyRef.current) return;
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        void runCheck({
          force: true,
          retryDelaysMs: FOCUS_BLOCK_RETRY_DELAYS_MS,
          silent: true,
        });
      }, FOCUS_RECHECK_SETTLE_MS);
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [runCheck]);

  // Lock scroll while the gate is up — desktop AND mobile. Just setting
  // body { overflow: hidden } is not enough on iOS Safari / Android Chrome:
  // touch scroll still bubbles to the document. So we also:
  //   • lock <html> overflow
  //   • pin body position:fixed at the current scroll offset (prevents rubber-
  //     banding and background scroll on touch devices)
  //   • block touchmove on anything outside the modal card
  // On unmount we restore the exact scroll position so returning to the page
  // feels seamless.
  useEffect(() => {
    if (!visible) return;
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    const blockTouch = (e: TouchEvent) => {
      const target = e.target as Node | null;
      if (target && gateRootRef.current?.contains(target)) return; // allow modal scroll
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener("touchmove", blockTouch, { passive: false });
    const blockWheel = (e: WheelEvent) => {
      const target = e.target as Node | null;
      if (target && gateRootRef.current?.contains(target)) return;
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener("wheel", blockWheel, { passive: false });

    // Keyboard scroll blockers — Space, PageUp/Down, arrows, Home/End.
    // Only preventDefault when the event target is OUTSIDE the modal so that
    // form-like elements inside the gate (buttons) still respond normally.
    // We do NOT swallow Tab (accessibility: focus must still cycle inside).
    const SCROLL_KEYS = new Set([
      " ", "Spacebar", "PageUp", "PageDown", "End", "Home",
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    ]);
    const blockKeys = (e: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(e.key)) return;
      const target = e.target as Node | null;
      if (target && gateRootRef.current?.contains(target)) return;
      e.preventDefault();
    };
    window.addEventListener("keydown", blockKeys, { passive: false });

    adblockLog("scroll-lock", "engaged", { scrollY });

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollY);
      document.removeEventListener("touchmove", blockTouch);
      document.removeEventListener("wheel", blockWheel);
      window.removeEventListener("keydown", blockKeys);
      adblockLog("scroll-lock", "released", { scrollY });
    };
  }, [visible]);

  // Tamper watchdog. Devtools users try to bypass the gate by deleting the
  // overlay node or setting display:none / visibility:hidden on it. We watch
  // for those mutations and restore visibility.
  //
  // CRITICAL: naive implementations freeze the page:
  //   • A MutationObserver whose callback writes styles will re-trigger itself
  //     forever unless we disconnect around the write.
  //   • Toggling `visible` false→true unmounts+remounts the overlay; the parent
  //     observer sees the old root vanish and fires again → infinite render.
  // We fix both by (a) disconnecting the self-observer while enforcing, and
  // (b) using a `renderKey` bump to force a fresh mount instead of a visibility
  // flip. Enforcement is also conditional (only writes when a value differs).
  useEffect(() => {
    if (!visible) return;
    if (TAMPER_DISABLED) {
      adblockLog("tamper", "watchdog disabled via VITE_ADBLOCK_TAMPER_DISABLE");
      return;
    }
    const root = gateRootRef.current;
    if (!root) return;
    const originalParent = root.parentNode;
    const originalNextSibling = root.nextSibling;

    let disposed = false;
    const REQUIRED: Array<[string, string]> = [
      ["display", "grid"],
      ["visibility", "visible"],
      ["opacity", "1"],
      ["pointer-events", "auto"],
      ["z-index", "2147483647"],
    ];

    // Only escalate if a REQUIRED value is actually being reverted. In
    // hosted preview environments (Lovable, Storybook, etc.) the editor
    // may inject `data-*` / `class` attributes on our overlay frequently
    // for tooling purposes — those are harmless and MUST NOT trigger the
    // escalation loop that used to freeze the page.
    const isActuallyTampered = (): boolean => {
      for (const [prop, val] of REQUIRED) {
        if (root.style.getPropertyValue(prop) !== val) return true;
      }
      if (root.hasAttribute("hidden")) return true;
      if (root.getAttribute("aria-hidden") !== "false") return true;
      if (document.documentElement.style.overflow !== "hidden") return true;
      if (document.body.style.overflow !== "hidden") return true;
      return false;
    };

    const enforceStamps: number[] = [];

    let selfObserver: MutationObserver | null = null;
    let parentObserver: MutationObserver | null = null;

    const restoreRootToReactParent = (reason: string) => {
      adblockLog("tamper", reason);
      try {
        // Put the exact same node back where React originally mounted it.
        // Appending to <body> makes the gate visible, but later React cleanup
        // can throw `removeChild: node is not a child of this node` because the
        // fiber still expects this node under its original parent container.
        if (originalParent?.isConnected) {
          originalParent.insertBefore(
            root,
            originalNextSibling?.isConnected ? originalNextSibling : null,
          );
        } else {
          document.body.appendChild(root);
        }
      } catch (err) {
        adblockLog("tamper", "restore failed", { err: String(err) });
      }
      // Also re-lock scroll — the deletion may have taken our styles with it.
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    };

    const enforce = () => {
      if (disposed) return;
      if (!isActuallyTampered()) return; // no-op: nothing to restore

      const now = Date.now();
      enforceStamps.push(now);
      while (enforceStamps.length && now - enforceStamps[0] > ENFORCE_WINDOW_MS) {
        enforceStamps.shift();
      }
      if (enforceStamps.length > ENFORCE_ESCALATE_AT) {
        adblockLog("tamper", "escalating to re-mount", { hits: enforceStamps.length });
        selfObserver?.disconnect();
        parentObserver?.disconnect();
        setRenderKey((k) => k + 1);
        return;
      }

      // Pause the observer so our own writes don't retrigger us.
      selfObserver?.disconnect();
      try {
        for (const [prop, val] of REQUIRED) {
          if (root.style.getPropertyValue(prop) !== val) {
            root.style.setProperty(prop, val, "important");
          }
        }
        if (root.hasAttribute("hidden")) root.removeAttribute("hidden");
        if (root.getAttribute("aria-hidden") !== "false") {
          root.setAttribute("aria-hidden", "false");
        }
        if (document.documentElement.style.overflow !== "hidden") {
          document.documentElement.style.overflow = "hidden";
        }
        if (document.body.style.overflow !== "hidden") {
          document.body.style.overflow = "hidden";
        }
        adblockLog("tamper", "restored overlay attributes");
      } finally {
        if (!disposed) {
          selfObserver?.observe(root, {
            attributes: true,
            attributeFilter: ["style", "hidden", "aria-hidden"], // NOT class — hosted editors mutate class harmlessly
          });
        }
      }
    };

    let handling = false;
    parentObserver = new MutationObserver(() => {
      if (handling || disposed) return;
      if (!document.body.contains(root)) {
        handling = true;
        restoreRootToReactParent("overlay removed from DOM, restoring to React parent");
        setTimeout(() => { handling = false; }, 100);
      }
    });
    parentObserver.observe(originalParent ?? document.body, { childList: true, subtree: false });

    selfObserver = new MutationObserver(enforce);
    queueMicrotask(enforce);

    const interval = window.setInterval(() => {
      if (disposed) return;
      if (!document.body.contains(root)) {
        restoreRootToReactParent("sweep found overlay missing, restoring to React parent");
      }
    }, SWEEP_INTERVAL_MS);

    return () => {
      disposed = true;
      selfObserver?.disconnect();
      parentObserver?.disconnect();
      window.clearInterval(interval);
    };
  }, [visible, renderKey]);

  // Focus trap. While the gate is up:
  //   • Auto-focus the primary button on mount (so keyboard users don't have
  //     to Tab into the modal from wherever they were).
  //   • On Tab / Shift-Tab, keep focus cycling among focusable elements inside
  //     the modal — never let it escape to background page content.
  //   • Restore focus to the previously focused element on unmount.
  useEffect(() => {
    if (!visible) return;
    const root = gateRootRef.current;
    if (!root) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] => {
      const nodes = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      return Array.from(nodes).filter((el) => !el.hasAttribute("aria-hidden"));
    };

    // Autofocus the first focusable (the "check again" button).
    queueMicrotask(() => {
      const focusables = getFocusable();
      focusables[0]?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = getFocusable();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // If focus somehow escaped the modal, pull it back to the first item.
      if (!active || !root.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", onKey);

    // If focus leaves the modal (e.g. programmatic focus elsewhere), yank it
    // back on the next tick. Using focusin at document scope catches it.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Node | null;
      if (target && !root.contains(target)) {
        const focusables = getFocusable();
        focusables[0]?.focus();
      }
    };
    document.addEventListener("focusin", onFocusIn);

    return () => {
      root.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      previouslyFocused?.focus?.();
    };
  }, [visible, renderKey]);

  if (!visible) return <AdblockDebugOverlay />;

  return (
    <>
    <AdblockDebugOverlay />
    <div
      key={renderKey}
      ref={gateRootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="adblock-gate-title"
      aria-describedby="adblock-gate-desc"
      className="fixed inset-0 grid place-items-center px-6"
      style={{
        zIndex: 2147483647,
        background:
          "radial-gradient(120% 80% at 50% 0%, rgba(60,10,90,0.65), rgba(5,0,15,0.92) 60%, rgba(0,0,0,0.96))",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        touchAction: "none",
        overscrollBehavior: "contain",
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-white/10 p-8 md:p-10 text-center shadow-2xl"
        style={{
          background:
            "linear-gradient(160deg, rgba(30,10,50,0.85), rgba(10,5,20,0.85))",
          boxShadow:
            "0 30px 80px -20px rgba(140,80,255,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-purple-200"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>

        <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-purple-300/80">
          {checking ? "Security check" : "Heads up, traveler"}
        </p>
        <h2
          id="adblock-gate-title"
          className="mb-3 font-display text-2xl md:text-3xl text-white"
          style={{ lineHeight: 1.05, paddingBottom: "0.08em" }}
        >
          {checking ? "Checking your browser" : "Please disable your ad blocker"}
        </h2>
        <p
          id="adblock-gate-desc"
          className="mb-6 text-sm md:text-base text-white/70 leading-relaxed"
        >
          {checking ? (
            <>
              Hang tight — we're checking for ad blockers and Brave Shields
              before opening the site. This only takes a moment.
            </>
          ) : (
            <>
              We don't run ads, trackers, or pop-ups — promise. But ad
              blockers (including <strong>Brave Shields</strong>) break the
              YouTube video embeds in our <strong>Work</strong> section, so
              you'd miss the good stuff. Turn it off for this site and
              reload, then click the button below.
            </>
          )}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={reloadForManualRecheck}
            disabled={checking}
            className="w-full sm:w-auto rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background:
                "linear-gradient(135deg, #a855f7, #6366f1 60%, #ec4899)",
              boxShadow: "0 10px 30px -8px rgba(168,85,247,0.55)",
            }}
          >
            {checking ? "Checking…" : "I've turned it off — check again"}
          </button>
        </div>


        <p className="mt-6 text-xs text-white/45">
          Tip: Brave users — click the lion icon → Shields DOWN for this site,
          then reload and check again.
        </p>
      </div>
    </div>
    </>
  );
}
