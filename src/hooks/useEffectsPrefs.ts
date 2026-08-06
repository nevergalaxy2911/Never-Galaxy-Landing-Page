import { createBoolPref, createNumberPref } from "./usePref";

export const clickSoundPref = createBoolPref("ng-sound-click", true);
export const cursorWindPref = createBoolPref("ng-sound-wind", true);
export const ambiencePref = createBoolPref("ng-sound-ambience", true);
export const reducedAudioPref = createBoolPref("ng-reduced-audio", false);

export const useClickSoundPref = clickSoundPref.use;
export const useWindPref = cursorWindPref.use;
export const useAmbiencePref = ambiencePref.use;
export const useReducedAudioPref = reducedAudioPref.use;

export const WIND_USER_LEVEL = 0.28;
export const TAB_FADE_MS = 450;
export const PANEL_SCROLL_CLOSE_MS = 180;

import { useEffect, useState } from "react";
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

export function useReducedAudio(): boolean {
  const [pref] = useReducedAudioPref();
  const prefersReducedMotion = usePrefersReducedMotion();
  return pref || prefersReducedMotion;
}
