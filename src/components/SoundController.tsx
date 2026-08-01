import { useEffect } from "react";
import {
  useClickSoundPref,
  useWindPref,
  useAmbiencePref,
  useReducedAudio,
  WIND_USER_LEVEL,
  TAB_FADE_MS,
} from "@/hooks/useEffectsPrefs";
import {
  playClick,
  startWind,
  stopWind,
  setWindIntensity,
  setWindUserLevel,
  setWindPan,
  setAmbiencePan,
  setReducedAudio,
  setSpatialAudio,
  setGlobalMute,
  noteTabFadeRequest,
  preloadAmbience,
  startAmbience,
  stopAmbience,
  unlockOnFirstGesture,
  resumeAudioAfterInterruption,

} from "@/lib/soundEngine";
import { shouldPrefetchHeavyAssets } from "@/lib/deviceTier";

/* -----------------------------------------------------------------------------
 * SoundController — headless component that wires the sound preferences to the
 * synthesised audio engine. Renders nothing.
 *
 * • Click sound  → one delegated pointerdown listener on the document; fires
 *                  only for real interactive elements (button/link/input).
 * • Wind         → a single looping wind voice. On desktop its loudness
 *                  follows the CURSOR speed; on phones/tablets it follows the
 *                  PAGE SCROLL speed (no cursor to follow there). The voice is
 *                  never restarted, so there are no clicks or retriggers.
 * • Ambience     → starts/stops the space pad, and pauses it when the tab hides
 *                  so a backgrounded tab is never making noise.
 *
 * MOBILE: the cursor driver is never used on touch devices — they get the
 * scroll driver, which needs no pointer and parks its RAF loop the moment the
 * page stops moving, so it costs nothing while reading.
 *
 * HOW TO MODIFY
 *   • Wind responsiveness → SCROLL_SPEED_FULL (px/s of scroll = "full gust"),
 *     SPEED_SMOOTH, WIND_ATTACK and WIND_RELEASE.
 *   • What counts as clickable → CLICK_SELECTOR.
 * --------------------------------------------------------------------------- */

// Wind driver thresholds — see the WIND section below.
// px/s of CURSOR movement that counts as a full gust (desktop driver).
const CURSOR_SPEED_FULL = 2200;
const CLICK_SELECTOR = 'button, a, [role="button"], input[type="submit"], summary';
// px/s of PAGE scroll that counts as a full gust.
const SCROLL_SPEED_FULL = 2600;
// Stage-1 low-pass on the raw scroll speed (per frame at 60fps). Lower = silkier
// but laggier; this is the knob that removes all perceptible stepping.
const SPEED_SMOOTH = 0.12;
// Stage-2 asymmetric loudness filter, expressed per-frame at 60fps.
const WIND_ATTACK = 0.09; // how much of the gap we close per frame while rising
const WIND_RELEASE = 0.035; // ...and while falling (slower = longer, softer tail)
const WIND_REDUCED_SCALE = 0.45; // extra attenuation applied while reduced audio is on


function hasFinePointer() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function SoundController() {
  const [clickOn] = useClickSoundPref();
  const [windOn] = useWindPref();
  const [ambienceOn] = useAmbiencePref();
  // Spatial (stereo) panning is always on — no longer a user option.
  const spatial = true;
  const reducedAudio = useReducedAudio();

  // Any sound enabled → make sure the AudioContext gets unlocked by the first
  // gesture, otherwise browsers keep it suspended and nothing plays.
  useEffect(() => {
    if (!clickOn && !windOn && !ambienceOn) return;
    return unlockOnFirstGesture();
  }, [clickOn, windOn, ambienceOn]);

  useEffect(() => {
    if (!clickOn) return;
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(CLICK_SELECTOR);
      if (!el) return;
      playClick((el as HTMLElement).dataset.softClick !== undefined);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, [clickOn]);

  // Keep the engine's global modes in sync with the user's saved preferences.
  useEffect(() => {
    setReducedAudio(reducedAudio);
  }, [reducedAudio]);

  useEffect(() => {
    setSpatialAudio(spatial);
  }, [spatial]);

  // Tab-switch fade length is user-configurable; push it into the engine live
  // so the very next hide/show uses the new duration without a reload.
  useEffect(() => {
    noteTabFadeRequest(TAB_FADE_MS / 1000);
  }, []);

  useEffect(() => {
    setWindUserLevel(WIND_USER_LEVEL * (reducedAudio ? WIND_REDUCED_SCALE : 1));
  }, [reducedAudio]);

  /* -------------------------------------------------------------------------
   * WIND — ONE voice, TWO drivers, picked by device (2026-07-29)
   *
   *   • Large / pointer devices  → CURSOR WIND. Loudness follows how fast the
   *     mouse is moving. Scroll wind is deliberately NOT used here.
   *   • Small / touch devices    → SCROLL WIND. There is no hovering cursor to
   *     follow (people tap), so the page's own scroll speed drives it instead.
   *
   * BUTTERY-SMOOTH RULES (both drivers)
   *   1. Speed is measured once per animation frame, never per input event
   *      (events fire in irregular bursts — that is what caused stepping).
   *   2. The raw speed goes through a one-pole smoother FIRST (SPEED_SMOOTH).
   *   3. That smoothed speed then drives a second, asymmetric one-pole filter
   *      (attack faster than release), so the wind sighs out instead of cutting.
   *   4. Values are pushed only when they moved, and the engine applies them
   *      with setTargetAtTime — zero audible steps.
   *
   * HOW TO MODIFY: CURSOR_SPEED_FULL (desktop sensitivity), SCROLL_SPEED_FULL
   * (mobile sensitivity), or the shared smoothing constants at the top.
   * ------------------------------------------------------------------------- */
  useEffect(() => {
    // REDUCED AUDIO: the wind is a continuous bed, so reduced mode drops it
    // entirely rather than just turning it down. The ambient pad stays (even
    // quieter) so the page is never completely silent.
    if (!windOn || reducedAudio) return;

    // Which driver? Fine pointer + roomy viewport = cursor; everything else
    // (phones, tablets, touch laptops in narrow windows) = scroll.
    const cursorDriven = hasFinePointer() && window.innerWidth >= 1024;

    let lastY = window.scrollY;
    let lastPx = 0;
    let lastPy = 0;
    let havePointer = false;
    let pointerDist = 0; // px accumulated since the last frame
    let lastT = performance.now();
    let smoothSpeed = 0; // px/s, low-passed
    let level = 0; // 0..1 loudness actually sent
    let pan = 0;
    let panTarget = 0;
    let raf = 0;
    let sent = -1;
    let idleFrames = 0;

    // Start silent; the engine's own envelope swells it in over ~1.6s.
    startWind();

    const onMove = (e: PointerEvent) => {
      // Stereo placement always follows the cursor when there is one.
      panTarget = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      if (!cursorDriven) return;
      if (havePointer) {
        pointerDist += Math.hypot(e.clientX - lastPx, e.clientY - lastPy);
      }
      lastPx = e.clientX;
      lastPy = e.clientY;
      havePointer = true;
      wake();
    };

    const tick = () => {
      const now = performance.now();
      const dt = Math.max(8, now - lastT);
      let raw: number;
      if (cursorDriven) {
        raw = (pointerDist / dt) * 1000; // px per second of cursor travel
        pointerDist = 0;
      } else {
        const y = window.scrollY;
        raw = (Math.abs(y - lastY) / dt) * 1000; // px per second of page travel
        lastY = y;
      }
      lastT = now;

      // Stage 1 — smooth the *speed* itself so bursty input events vanish.
      smoothSpeed += (raw - smoothSpeed) * SPEED_SMOOTH;

      // sqrt curve: gentle motion is audible without fast flicks slamming to 1.
      const full = cursorDriven ? CURSOR_SPEED_FULL : SCROLL_SPEED_FULL;
      const target = Math.min(1, Math.sqrt(smoothSpeed / full));

      // Stage 2 — asymmetric loudness filter (rises quicker than it falls).
      const k = target > level ? WIND_ATTACK : WIND_RELEASE;
      level += (target - level) * k;
      if (level < 0.0015) level = 0;

      if (Math.abs(level - sent) > 0.0015 || (level === 0 && sent !== 0)) {
        setWindIntensity(level);
        sent = level;
      }
      if (cursorDriven) {
        pan += (panTarget - pan) * 0.05;
        setWindPan(pan);
      }

      /* BATTERY SAVER — once nothing is moving and the wind has fully sighed
       * out, park the RAF loop entirely. Motion wakes it back up, keeping the
       * sound layer at literally zero cost while reading.
       * HOW TO MODIFY: raise 30 to keep the loop alive longer after a stop. */
      idleFrames = level === 0 && raw < 1 ? idleFrames + 1 : 0;
      if (idleFrames > 30) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    function wake() {
      if (raf) return;
      lastT = performance.now();
      lastY = window.scrollY;
      idleFrames = 0;
      raf = requestAnimationFrame(tick);
    }
    wake();

    if (!cursorDriven) window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", wake);
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      stopWind();
    };
    // NOTE: deliberately depends on `windOn` only. Reduced audio is applied
    // live by the effect above via smooth gain ramps, so changing it never
    // restarts the wind voice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windOn, reducedAudio]);



  // Ambience panning: a very slow drift that tracks the cursor, giving the pad
  // a sense of physical space without demanding its own RAF loop.
  useEffect(() => {
    if (!ambienceOn || !spatial) return;
    let pan = 0;
    let panTarget = 0;
    let timer = 0;
    const onMove = (e: PointerEvent) => {
      panTarget = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    };
    // 10Hz is plenty for a bed that ramps over 0.5s — no per-frame cost.
    timer = window.setInterval(() => {
      pan += (panTarget - pan) * 0.25;
      setAmbiencePan(pan);
    }, 100);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearInterval(timer);
      setAmbiencePan(0);
    };
  }, [ambienceOn, spatial]);

  useEffect(() => {
    if (!ambienceOn) {
      stopAmbience();
      return;
    }
    startAmbience();
    return () => stopAmbience();
  }, [ambienceOn]);

  /* ---------------------------------------------------------------------------
   * TAB VISIBILITY → GLOBAL MUTE
   * Switching to another tab ducks the whole master bus to silence over 0.25s
   * (wind, ambience, clicks — everything). Coming back ramps it straight back
   * up, and because nothing is torn down the music keeps its position.
   * ------------------------------------------------------------------------- */
  useEffect(() => {
    const onVisibility = () => {
      setGlobalMute(document.hidden);
      // Returning to the tab: iOS/Android may have frozen or killed the audio
      // context while we were away, so nudge it back to life.
      if (!document.hidden) resumeAudioAfterInterruption();
    };
    const onWake = () => resumeAudioAfterInterruption();
    document.addEventListener("visibilitychange", onVisibility);
    // pageshow fires on bfcache restores (iOS back-swipe), focus covers the
    // "phone call ended, Safari came back" case.
    window.addEventListener("pageshow", onWake);
    window.addEventListener("focus", onWake);
    onVisibility();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onWake);
      window.removeEventListener("focus", onWake);
      setGlobalMute(false);
    };
  }, []);


  /* Warm the ambient track into on-device storage while the browser is idle,
   * so the first time the visitor flips ambience on it starts instantly. */
  useEffect(() => {
    if (!ambienceOn) return;
    // ~1.5MB download — never speculatively pulled on Data Saver / low-end.
    if (!shouldPrefetchHeavyAssets()) return;
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => preloadAmbience());
    else window.setTimeout(preloadAmbience, 2500);
  }, [ambienceOn]);

  return null;
}

export default SoundController;
