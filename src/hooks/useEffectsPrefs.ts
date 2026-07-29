import { useEffect, useState } from "react";
import { createBoolPref, createNumberPref } from "@/hooks/usePref";

/* -----------------------------------------------------------------------------
 * useEffectsPrefs — the optional "feel" toggles that are still user-facing.
 *
 * All of these persist to localStorage and broadcast changes, so the nav
 * popover and the effect runtimes never disagree.
 *
 * KEYS (localStorage):
 *   ng-sound-click    → short UI click blip on buttons/links
 *   ng-sound-wind     → continuous wind. On desktop it follows the CURSOR speed;
 *                        on phones/tablets (no hovering cursor) it follows the
 *                        PAGE SCROLL speed instead. One pref, two drivers.
 *   ng-sound-ambience → looping spacious space pad
 *   ng-reduced-audio  → quieter, calmer continuous sound
 *
 * ALWAYS-ON (2026-07-29 — removed from the menu, hard-coded in the runtime):
 *   • Smooth scroll          — always on (SmoothScroll.tsx)
 *   • Spatial audio          — always on (SoundController.tsx)
 *   • Progressive previews   — always on (lib/imageCache.ts)
 *   • Preview quality cap    — automatic, driven by lib/autoQuality.ts
 *   • Close panels on scroll — always on, fixed delay (hooks/useCloseOnScroll)
 *   • Diagnostics panel      — removed entirely
 *   • Wind intensity         — fixed, tuned loud enough to sit over the pad
 *   • Tab-switch fade        — fixed TAB_FADE_MS below
 *
 * HOW TO MODIFY: flip a default below, or add a new pref with createBoolPref.
 * --------------------------------------------------------------------------- */

export const clickSoundPref = createBoolPref("ng-sound-click", false);
export const cursorWindPref = createBoolPref("ng-sound-wind", false);
export const ambiencePref = createBoolPref("ng-sound-ambience", false);

export const useClickSoundPref = clickSoundPref.use;
/** Continuous wind: cursor-speed driven on desktop, scroll-speed on mobile. */
export const useWindPref = cursorWindPref.use;
export const useAmbiencePref = ambiencePref.use;


/* -----------------------------------------------------------------------------
 * ACCESSIBILITY
 *
 *   ng-reduced-audio → "Reduced audio": continuous sounds (wind + ambience)
 *                      are heavily attenuated and slowed instead of removed.
 *                      Defaults ON automatically for visitors whose OS asks
 *                      for reduced motion (see useReducedAudio below).
 * --------------------------------------------------------------------------- */
export const reducedAudioPref = createBoolPref("ng-reduced-audio", false);
export const useReducedAudioPref = reducedAudioPref.use;

/* -----------------------------------------------------------------------------
 * FIXED AUDIO CONSTANTS (were sliders, now tuned once)
 *
 *   WIND_USER_LEVEL → 0..1 base loudness of the wind before the engine's own
 *                     ambience boost. Kept at 1 so the wind stays clearly
 *                     audible even with the ambient pad running.
 *   TAB_FADE_MS     → how long ALL output audio takes to fade out when the tab
 *                     is hidden (the return swell is 2x this).
 * --------------------------------------------------------------------------- */
/* 2026-07-29: the old "reduced audio" wind level is now the default, matching
   the quieter ambient pad. Reduced audio switches the wind off completely. */
export const WIND_USER_LEVEL = 0.28;
export const TAB_FADE_MS = 450;

/* -----------------------------------------------------------------------------
 * FLOATING-PANEL DISMISSAL (no longer user-configurable)
 *
 * Scrolling the page always dismisses an open panel, after a short delay that
 * feels deliberate rather than twitchy. A panel is never auto-closed while the
 * focus sits in a text field / textarea / select — see hooks/useCloseOnScroll.
 *
 * HOW TO MODIFY: change PANEL_SCROLL_CLOSE_MS below.
 * --------------------------------------------------------------------------- */
export const PANEL_SCROLL_CLOSE_MS = 180;



/** True when the OS/browser asks for reduced motion. SSR-safe (false first). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/**
 * The value the audio layer should actually obey: the explicit user toggle OR
 * the OS-level reduced-motion request. This is what makes continuous effects
 * automatically calm down on sensitive devices without any user action.
 */
export function useReducedAudio(): boolean {
  const [pref] = useReducedAudioPref();
  const prefersReducedMotion = usePrefersReducedMotion();
  return pref || prefersReducedMotion;
}
