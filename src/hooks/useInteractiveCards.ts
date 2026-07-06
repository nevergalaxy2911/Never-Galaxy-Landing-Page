import { useEffect } from "react";

/* -----------------------------------------------------------------------------
 * useInteractiveCards — RAF-driven cursor tilt + border glow + surface
 * spotlight, applied to every `.bento` card and `.btn-tilt` element on the
 * page.
 *
 * Extracted from InteractiveCards.tsx so the component stays a thin mount
 * and the RAF/tilt logic can be reused (tested, imported elsewhere) without
 * dragging JSX in with it.
 *
 * Effects (all synced via shared CSS vars on each target element):
 *   1. 3D tilt         → --tx / --ty
 *   2. Border wedge     → --angle / --edge
 *   3. Surface spotlight → --mx / --my / --active
 *   4. Motion-driven hue → --hue (only advances while the cursor moves)
 *
 * Gates: no-op on touch, `(hover: none)`, `(pointer: coarse)`, screens
 * below 1024px, or `prefers-reduced-motion` — so nothing paints on phones
 * and the "glitch when at the edge of a card" story from small screens
 * never fires.
 *
 * TUNING (top of this file):
 *   MAX_TILT_CARD  — max rotation for `.bento` cards (deg)
 *   MAX_TILT_BTN   — max rotation for `.btn-tilt` elements (deg)
 *   LERP           — smoothing per frame (higher = snappier)
 *   EDGE_SENSITIVITY — 0..1 dead zone before border glow starts
 *   HUE_PER_PX     — deg of hue shift per pixel of cursor motion
 * --------------------------------------------------------------------------- */

// TUNING KNOBS ---------------------------------------------------------------
const MAX_TILT_CARD = 6;
const MAX_TILT_BTN = 10;
const LERP = 0.28;
const EDGE_SENSITIVITY = 0.15;
const HUE_PER_PX = 1.6;

// Every element that should get the interactive treatment. `.btn-tilt` keeps
// the currency dropdown / scope menu tilt hooks; only `.bento` gets the full
// border-wedge + spotlight combo (the isBtn branch skips it).
const TARGET_SELECTOR = ".bento, .btn-tilt";

type CardState = {
  el: HTMLElement;
  isBtn: boolean;
  // targets
  tmx: number; tmy: number; ttx: number; tty: number; tact: number;
  tangle: number; tedge: number;
  // current (rendered) values
  mx: number; my: number; tx: number; ty: number; act: number;
  angle: number; edge: number;
  // motion-driven hue shift — only advances when the cursor is actually
  // moving over the card. Standing still holds the current color.
  hue: number;
  lastPx: number; lastPy: number;
};

/** Shortest-path lerp between two angles (0..360). */
function lerpAngle(current: number, target: number, t: number): number {
  const diff = ((target - current + 540) % 360) - 180;
  return current + diff * t;
}

export function useInteractiveCards() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isSmallScreen = window.matchMedia("(max-width: 1023px)").matches;
    const isTouch =
      window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      (navigator.maxTouchPoints ?? 0) > 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Mobile/low-end devices keep the static glass look but skip all RAF-driven
    // cursor tilt/glow work. Biggest perf + glitch-avoidance win.
    if (isSmallScreen || isTouch || reduced) return;

    const states = new WeakMap<HTMLElement, CardState>();
    const active = new Set<HTMLElement>();

    const getState = (el: HTMLElement): CardState => {
      let s = states.get(el);
      if (!s) {
        s = {
          el,
          isBtn: !el.classList.contains("bento"),
          tmx: 50, tmy: 50, ttx: 0, tty: 0, tact: 0, tangle: 0, tedge: 0,
          mx: 50, my: 50, tx: 0, ty: 0, act: 0, angle: 0, edge: 0,
          hue: 0, lastPx: -1, lastPy: -1,
        };
        states.set(el, s);
      }
      return s;
    };

    const onMove = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.(TARGET_SELECTOR) as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const dx = x - cx;
      const dy = y - cy;

      // Proximity: 0 at center, 1 exactly on any edge. Corners naturally
      // reach 1 on both axes so the border wedge is widest/brightest there.
      const proxRaw = Math.min(
        1,
        Math.max(Math.abs(dx) / cx, Math.abs(dy) / cy)
      );
      const edgeT = Math.max(0, (proxRaw - EDGE_SENSITIVITY) / (1 - EDGE_SENSITIVITY));
      const edge = edgeT * edgeT * (3 - 2 * edgeT); // smoothstep

      // Angle: 0deg = top (12 o'clock), CW. Matches CSS conic `from Xdeg`.
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;

      const s = getState(target);
      const tilt = s.isBtn ? MAX_TILT_BTN : MAX_TILT_CARD;

      // Advance the hue ONLY when the pointer actually moves.
      if (s.lastPx >= 0) {
        const ddx = e.clientX - s.lastPx;
        const ddy = e.clientY - s.lastPy;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        s.hue = (s.hue + dist * HUE_PER_PX) % 360;
      }
      s.lastPx = e.clientX;
      s.lastPy = e.clientY;

      s.tmx = (x / w) * 100;
      s.tmy = (y / h) * 100;
      s.tty = (dx / cx) * tilt;
      s.ttx = -(dy / cy) * tilt;
      s.tact = 1;
      s.tangle = angle;
      s.tedge = edge;
      active.add(target);
      ensureLoop();
    };


    const onLeave = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.(TARGET_SELECTOR) as HTMLElement | null;
      if (!target) return;
      // pointerout fires when moving between child elements INSIDE the same
      // card (e.g. from a video preview into the title strip). Blind reset
      // here caused the "tilt animation glitch when I'm not over the
      // dropdown" bug — only reset when the pointer truly leaves the card.
      const related = e.relatedTarget as Node | null;
      if (related && target.contains(related)) return;
      const s = getState(target);
      s.ttx = 0; s.tty = 0; s.tact = 0; s.tedge = 0;
      active.add(target); // keep animating until it eases back to rest
      ensureLoop();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onLeave, { passive: true });

    let raf = 0;
    let running = false;
    const tick = () => {
      for (const el of active) {
        const s = states.get(el);
        if (!s) { active.delete(el); continue; }
        s.mx += (s.tmx - s.mx) * LERP;
        s.my += (s.tmy - s.my) * LERP;
        s.tx += (s.ttx - s.tx) * LERP;
        s.ty += (s.tty - s.ty) * LERP;
        s.act += (s.tact - s.act) * LERP;
        s.edge += (s.tedge - s.edge) * LERP;
        s.angle = lerpAngle(s.angle, s.tangle, LERP);

        el.style.setProperty("--hue", `${s.hue.toFixed(1)}deg`);
        el.style.setProperty("--mx", `${s.mx.toFixed(2)}%`);
        el.style.setProperty("--my", `${s.my.toFixed(2)}%`);
        el.style.setProperty("--tx", `${s.tx.toFixed(2)}deg`);
        el.style.setProperty("--ty", `${s.ty.toFixed(2)}deg`);
        el.style.setProperty("--active", s.act.toFixed(3));
        el.style.setProperty("--edge", s.edge.toFixed(3));
        el.style.setProperty("--angle", `${s.angle.toFixed(2)}deg`);

        // Prune once fully settled at rest
        if (
          s.tact === 0 &&
          Math.abs(s.tx) < 0.05 && Math.abs(s.ty) < 0.05 &&
          s.act < 0.01 && s.edge < 0.01
        ) {
          el.style.setProperty("--tx", `0deg`);
          el.style.setProperty("--ty", `0deg`);
          el.style.setProperty("--active", `0`);
          el.style.setProperty("--edge", `0`);
          active.delete(el);
        }
      }
      // PERF: only reschedule while there's work to do. Previously the loop
      // ran forever at 60fps for every desktop visit even when no card was
      // hovered — a permanent main-thread tax on all sessions. onMove /
      // onLeave call ensureLoop() to restart it when new work arrives.
      if (active.size > 0) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };
    function ensureLoop() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      running = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
    };
  }, []);
}

