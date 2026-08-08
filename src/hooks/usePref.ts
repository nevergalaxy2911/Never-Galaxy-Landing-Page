/**
 * usePref.ts
 *
 * Persistence layer for site settings. These values are stored in localStorage
 * so they survive refreshes and returns, and broadcast changes via the Storage
 * API so multiple open tabs (e.g. site and admin) stay synced.
 *
 * NOTE: usePref only works for primitive types (boolean, number, string).
 */
import { useCallback, useSyncExternalStore } from "react";

const LISTENERS = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  LISTENERS.add(onStoreChange);
  return () => LISTENERS.delete(onStoreChange);
}

function broadcast() {
  LISTENERS.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", broadcast);
}

export function createBoolPref(key: string, defaultValue: boolean, legacyMuteKey?: string) {
  const getSnapshot = () => {
    if (typeof window === "undefined") return defaultValue;
    
    // Check for legacy mute key if provided (inverted logic for 'muted')
    if (legacyMuteKey) {
      const muted = localStorage.getItem(legacyMuteKey);
      if (muted !== null) return muted === "false"; // if 'true', sound is off (wanted=false)
    }

    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    return val === "true";
  };

  return {
    get: getSnapshot,
    set: (v: boolean) => {
      if (typeof window === "undefined") return;
      localStorage.setItem(key, String(v));
      if (legacyMuteKey) {
        localStorage.setItem(legacyMuteKey, String(!v));
      }
      broadcast();
    },
    use: (): [boolean, (v: boolean) => void] => {
      const val = useSyncExternalStore(subscribe, getSnapshot, () => defaultValue);
      const setVal = useCallback((v: boolean) => {
        localStorage.setItem(key, String(v));
        if (legacyMuteKey) {
          localStorage.setItem(legacyMuteKey, String(!v));
        }
        broadcast();
      }, []);
      return [val, setVal];
    },
  };
}

export function createNumberPref(key: string, defaultValue: number) {
  const getSnapshot = () => {
    if (typeof window === "undefined") return defaultValue;
    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    const n = Number(val);
    return isNaN(n) ? defaultValue : n;
  };

  return {
    get: getSnapshot,
    set: (v: number) => {
      if (typeof window === "undefined") return;
      localStorage.setItem(key, String(v));
      broadcast();
    },
    use: (): [number, (v: number) => void] => {
      const val = useSyncExternalStore(subscribe, getSnapshot, () => defaultValue);
      const setVal = useCallback((v: number) => {
        localStorage.setItem(key, String(v));
        broadcast();
      }, []);
      return [val, setVal];
    },
  };
}
