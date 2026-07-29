import { useEffect, useState } from "react";

/* -----------------------------------------------------------------------------
 * usePref — tiny factory for boolean, localStorage-backed user preferences.
 *
 * WHY: the site already has three hand-rolled preference hooks (cursor trail,
 * optimized mode, theme). Every new toggle (smooth scroll, sounds, diagnostics)
 * needs the exact same four things:
 *   1. read from localStorage safely (private mode throws),
 *   2. write + broadcast so every mounted listener stays in sync,
 *   3. cross-tab sync via the `storage` event,
 *   4. SSR-safe default so hydration never mismatches.
 *
 * HOW TO ADD A NEW TOGGLE:
 *   export const { use: useThing, read: readThing, set: setThing,
 *                  subscribe: onThingChange } = createBoolPref("ng-thing", true);
 *
 * HOW TO MODIFY:
 *   • Change a default → second argument of createBoolPref.
 *   • Rename a key    → users silently fall back to the default once.
 * --------------------------------------------------------------------------- */
export type BoolPref = {
  key: string;
  read: () => boolean;
  set: (v: boolean) => void;
  subscribe: (cb: (v: boolean) => void) => () => void;
  use: () => [boolean, (v: boolean) => void];
};

export function createBoolPref(key: string, defaultValue: boolean): BoolPref {
  const EVENT = `${key}-change`;

  const read = (): boolean => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const v = window.localStorage.getItem(key);
      if (v === "on") return true;
      if (v === "off") return false;
    } catch {
      /* private mode / storage disabled */
    }
    return defaultValue;
  };

  const set = (v: boolean) => {
    try {
      window.localStorage.setItem(key, v ? "on" : "off");
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
  };

  const subscribe = (cb: (v: boolean) => void) => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      cb(typeof detail === "boolean" ? detail : read());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) cb(read());
    };
    window.addEventListener(EVENT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  };

  const use = (): [boolean, (v: boolean) => void] => {
    // SSR-safe: always start at the default, then correct in an effect. This is
    // what keeps server and first client render byte-identical.
    const [value, setValue] = useState(defaultValue);
    useEffect(() => {
      setValue(read());
      return subscribe(setValue);
    }, []);
    return [value, (v: boolean) => { setValue(v); set(v); }];
  };

  return { key, read, set, subscribe, use };
}

/* -----------------------------------------------------------------------------
 * createNumberPref — same contract as createBoolPref, but for a clamped number
 * (used by the cursor-wind intensity slider).
 *
 * HOW TO MODIFY: pass a different { min, max } to change the allowed range, or
 * change `defaultValue` to move the out-of-the-box position of the slider.
 * --------------------------------------------------------------------------- */
export type NumberPref = {
  key: string;
  read: () => number;
  set: (v: number) => void;
  subscribe: (cb: (v: number) => void) => () => void;
  use: () => [number, (v: number) => void];
};

export function createNumberPref(
  key: string,
  defaultValue: number,
  { min = 0, max = 1 }: { min?: number; max?: number } = {},
): NumberPref {
  const EVENT = `${key}-change`;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const read = (): number => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const n = Number.parseFloat(raw);
        if (Number.isFinite(n)) return clamp(n);
      }
    } catch {
      /* private mode / storage disabled */
    }
    return defaultValue;
  };

  const set = (v: number) => {
    const next = clamp(v);
    try {
      window.localStorage.setItem(key, String(next));
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  };

  const subscribe = (cb: (v: number) => void) => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      cb(typeof detail === "number" ? detail : read());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) cb(read());
    };
    window.addEventListener(EVENT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  };

  const use = (): [number, (v: number) => void] => {
    const [value, setValue] = useState(defaultValue);
    useEffect(() => {
      setValue(read());
      return subscribe(setValue);
    }, []);
    return [value, (v: number) => { setValue(clamp(v)); set(v); }];
  };

  return { key, read, set, subscribe, use };
}
