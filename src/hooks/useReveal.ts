import { useEffect, useRef } from "react";

/* -----------------------------------------------------------------------------
 * useReveal — persistent scroll-triggered reveal.
 * HOW IT WORKS:
 * • Attach the returned ref to any element that also has the `reveal` class.
 * • Once the element crosses the viewport threshold, we add `is-visible` and
 *   STOP observing — so scrolling past does NOT remove it (Master Rulebook §2).
 * • Optional `delay` in ms staggers children when mapping.
 * --------------------------------------------------------------------------- */
export function useReveal<T extends HTMLElement = HTMLDivElement>(delay = 0) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Mobile/low-end performance path: reveal immediately instead of running
    // lots of delayed IntersectionObserver animations during first paint.
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobilePerf =
      window.matchMedia("(max-width: 767px)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches;
    if (prefersReduced || isMobilePerf) {
      el.classList.add("is-visible");
      return;
    }

    // ABOVE-THE-FOLD FAST PATH — if the element is already inside the
    // initial viewport at mount, reveal immediately (no IO, no delay). This
    // is critical for the hero: `useReveal(delay)` used to defer the LCP text
    // by up to ~360ms because the delay fired even when the element was
    // already onscreen. Below-the-fold sections still get the observer +
    // stagger treatment unchanged.
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh && rect.bottom > 0) {
      el.classList.add("is-visible");
      return;
    }

    let timeoutId: number | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            timeoutId = window.setTimeout(() => el.classList.add("is-visible"), delay);
            io.unobserve(el); // persistent — never remove
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -80px 0px" }
    );
    io.observe(el);

    return () => {
      // Cancel the pending reveal timer if the component unmounts before it
      // fires. Prevents "cannot read properties of null" DOM writes and any
      // leaked timers when navigating away mid-reveal.
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      io.disconnect();
    };
  }, [delay]);
  return ref;
}
