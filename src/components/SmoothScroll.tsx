import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { readOptimizedMode } from "@/hooks/useOptimizedMode";

/**
 * SmoothScroll — Lenis-based smooth wheel + delegated in-page anchor smooth-scroll.
 *
 * PERF NOTE (2026-07-23): previously imported gsap + ScrollTrigger purely so
 * `lenis.on("scroll", ScrollTrigger.update)` could keep GSAP triggers in sync.
 * No component actually registers ScrollTriggers, so GSAP was ~250KB of dead
 * weight in the client bundle. Removed. If a future animation needs GSAP,
 * `dynamic import("gsap")` inside that component's effect keeps this file lean.
 */
declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/**
 * SMOOTH SCROLL PREFERENCE (nav → Experience → "Smooth scroll")
 * ------------------------------------------------------------
 * ON  : Lenis eased wheel, reveal animations run at their full timing.
 * OFF : native browser scrolling, reveal animations are shortened via the
 *       `--reveal-dur` CSS var so nothing lags behind the scroll position.
 *
 * Optimized Mode additionally shortens Lenis' duration, because a long ease
 * means more frames of JS-driven scrolling on a machine that is already
 * struggling — that is exactly where the occasional stutter came from.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  // Smooth scroll is always on (2026-07-29: removed from the Experience menu).
  const smooth = true;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-smooth", smooth ? "on" : "off");
    // Mobile / low-end devices: Lenis JS-driven smooth wheel actually FIGHTS
    // native touch scroll on Android and causes noticeable stutter, especially
    // after tapping a nav anchor. On those devices we skip Lenis entirely and
    // fall back to native smooth scroll via CSS `scroll-behavior`.
    const isMobile =
      window.matchMedia("(max-width: 1023px)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches;

    if (isMobile || !smooth) {
      // Native scrolling path. `scroll-behavior: smooth` only affects anchor
      // jumps, never the wheel/touch, so turning the preference off gives you
      // fully native (zero JS) scrolling.
      document.documentElement.style.scrollBehavior = smooth ? "smooth" : "auto";
      const onAnchorClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const anchor = (e.target as HTMLElement | null)?.closest?.("a") as HTMLAnchorElement | null;
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href || !href.startsWith("#") || href.length < 2) return;
        if (anchor.target && anchor.target !== "_self") return;
        if (anchor.dataset.noSmooth !== undefined) return;
        const id = href.slice(1);
        const el = id === "top" ? document.body : document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        const top = id === "top" ? 0 : el.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
        history.replaceState(null, "", href);
      };
      document.addEventListener("click", onAnchorClick);
      return () => {
        document.removeEventListener("click", onAnchorClick);
        document.documentElement.style.scrollBehavior = "";
      };
    }

    // Shorter ease in Optimized Mode = fewer JS-driven scroll frames.
    const duration = readOptimizedMode() ? 0.85 : 1.2;
    const lenis = new Lenis({
      duration,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    window.__lenis = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("#") || href.length < 2) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.dataset.noSmooth !== undefined) return;
      const id = href.slice(1);
      const el = id === "top" ? document.body : document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -70, duration });
      history.replaceState(null, "", href);
    };
    document.addEventListener("click", onAnchorClick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onAnchorClick);
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, [smooth]);
  return <>{children}</>;
}
