// Vitest setup — polyfills and jsdom quirks used by AdblockGate tests.
import "@testing-library/react";

if (typeof (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT === "undefined") {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

if (typeof window !== "undefined") {
  // jsdom lacks scrollTo; the scroll-lock effect calls it on cleanup.
  window.scrollTo = () => {};
  // jsdom lacks matchMedia; some components use it.
  if (!window.matchMedia) {
    // @ts-expect-error – minimal stub
    window.matchMedia = () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}
