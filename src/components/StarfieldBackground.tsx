import { useEffect, useRef, useState } from "react";
import { readOptimizedMode, onOptimizedModeChange } from "@/hooks/useOptimizedMode";

/**
 * Interactive starfield, WHITE stars over a deep purple/black wash.
 * - Random twinkling + gentle drift around each star's anchor.
 * - Cursor gravity: nearby stars are softly pulled toward the mouse,
 *   then spring back with damping when the cursor moves away.
 *
 * PERFORMANCE NOTES (why this file looks the way it does)
 *  1. NO per-star `shadowBlur`. Canvas shadows are the single most expensive
 *     2D op there is, ~hundreds of stars x 60fps was the main scroll-jank
 *     source. Instead we pre-render a small glow SPRITE once (radial gradient
 *     baked into an offscreen canvas) and `drawImage` it per star. Visually
 *     near identical, an order of magnitude cheaper.
 *  2. The nebula wash gradient is created ONCE per resize, not per frame.
 *  3. Frame budget cap, we skip draws faster than ~60fps (high-refresh
 *     monitors were running the whole sim at 120-165Hz for no visual gain).
 *  4. Optimized Mode (see hooks/useOptimizedMode) => single static frame,
 *     fewer/smaller stars, no gravity, no drift, no nebula.
 *
 * HOW TO MODIFY
 *  • Star density        → the `/ 4200` divisor and the clamp in `resize()`.
 *  • Glow softness/size  → `makeStarSprite()` (SPRITE_SCALE, gradient stops).
 *  • Cursor pull         → GRAVITY_RADIUS / GRAVITY_STRENGTH / SPRING / DAMPING.
 *  • Target framerate    → FRAME_MS below.
 */
type Star = {
  ax: number;
  ay: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  driftAngle: number;
  driftRadius: number;
  hueOffset: number; // per-star phase for pink cycling in light mode (0..360)
};

/** ~60fps ceiling. Raise to 8 for 120fps, lower to 33 for a 30fps cap. */
const FRAME_MS = 1000 / 60;

/**
 * Pre-render one soft round star into an offscreen canvas. Drawn later with
 * `drawImage` + globalAlpha, which replaces both `arc()+fill()` and the
 * expensive `shadowBlur` glow.
 */
function makeStarSprite(color: string, glow: string): HTMLCanvasElement {
  const SPRITE = 32; // px, sprite is scaled down per star
  const c = document.createElement("canvas");
  c.width = SPRITE;
  c.height = SPRITE;
  const g = c.getContext("2d")!;
  const r = SPRITE / 2;
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, color);
  grd.addColorStop(0.25, color);
  grd.addColorStop(0.5, glow);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, SPRITE, SPRITE);
  return c;
}

export function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });

  // MOBILE / TOUCH / SMALL SCREENS: skip the starfield entirely. Fully flat
  // mobile experience, no canvas, no RAF, no cursor listeners.
  //
  // HYDRATION: initial state MUST match server render. SSR has no `window`,
  // so it always renders the canvas (skip=false). The client then measures
  // viewport in a post-mount effect and flips `skip`.
  const [skip, setSkip] = useState(false);
  // Bumped whenever Optimized Mode changes, forces a full re-init of the loop.
  const [optimized, setOptimized] = useState(false);

  useEffect(() => {
    setOptimized(readOptimizedMode());
    return onOptimizedModeChange(setOptimized);
  }, []);

  useEffect(() => {
    const shouldSkip =
      window.matchMedia("(max-width: 1023px)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches;
    if (shouldSkip) {
      setSkip(true);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    // `alpha: true` is required (transparent overlay), but desynchronized
    // lets the browser skip a compositor sync point on supporting engines.
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;

    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let lastFrame = 0;
    let nebula: CanvasGradient | null = null;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCoarseOrSmall =
      window.matchMedia("(max-width: 767px)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches;
    /**
     * LOW-END HARDWARE DETECTION
     * Some laptops/tablets report a fine pointer and a wide viewport but have
     * a weak integrated GPU and very few cores. Animating a few hundred
     * composited sprites there is exactly what makes scrolling feel "sticky".
     * `deviceMemory` (GB) and `hardwareConcurrency` (logical cores) are the two
     * cheap signals available in the browser; both are Chromium-friendly and
     * simply undefined elsewhere (in which case we assume a capable machine).
     * HOW TO MODIFY: raise/lower the 4GB / 4-core thresholds below.
     */
    const nav = navigator as Navigator & { deviceMemory?: number };
    const isLowEndDevice =
      (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) ||
      (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4);
    // perfMode = "render one static frame and stop". Triggered by reduced
    // motion, small/coarse screens, weak hardware, or Optimized Mode.
    const perfMode = reducedMotion || isCoarseOrSmall || isLowEndDevice || optimized;


    // Cached sprites, one for dark mode (white) and one per light-mode hue
    // bucket (pink cycling). 12 buckets is visually smooth and keeps the
    // sprite cache tiny.
    const whiteSprite = makeStarSprite("rgba(255,255,255,1)", "rgba(230,220,255,0.45)");
    const HUE_BUCKETS = 12;
    const pinkSprites: HTMLCanvasElement[] = [];
    for (let i = 0; i < HUE_BUCKETS; i++) {
      const hue = 310 + (i / HUE_BUCKETS) * 36; // 310..346, magenta → rose
      pinkSprites.push(
        makeStarSprite(`hsla(${hue}, 85%, 36%, 1)`, `hsla(${hue}, 90%, 48%, 0.45)`),
      );
    }

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      // Clamp DPR harder in perf mode. High-DPR canvas animation is expensive
      // on budget devices; crisp stars matter less than scroll FPS.
      dpr = perfMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Nebula gradient built once per resize instead of once per frame.
      const grd = ctx.createRadialGradient(
        width * 0.5,
        height * 0.4,
        0,
        width * 0.5,
        height * 0.4,
        Math.max(width, height) * 0.75,
      );
      grd.addColorStop(0, "rgba(120, 60, 200, 0.16)");
      grd.addColorStop(0.55, "rgba(55, 20, 100, 0.08)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      nebula = grd;

      const density = Math.floor((width * height) / (perfMode ? 12000 : 5200));
      const count = perfMode
        ? Math.min(Math.max(density, 40), 90)
        : Math.min(Math.max(density, 180), 340);
      stars = new Array(count).fill(0).map(() => {
        const ax = Math.random() * width;
        const ay = Math.random() * height;
        return {
          ax,
          ay,
          x: ax,
          y: ay,
          vx: 0,
          vy: 0,
          size: perfMode ? Math.random() * 1.3 + 0.5 : Math.random() * 2.4 + 0.7,
          baseAlpha: perfMode ? Math.random() * 0.35 + 0.35 : Math.random() * 0.55 + 0.45,
          twinkleSpeed: perfMode ? 0 : Math.random() * 0.003 + 0.0008,
          twinkleOffset: Math.random() * Math.PI * 2,
          driftAngle: Math.random() * Math.PI * 2,
          driftRadius: perfMode ? 0 : Math.random() * 8 + 2,
          hueOffset: Math.random() * 360,
        };
      });
    };

    /**
     * Cursor-vs-CONTENT shielding (strict).
     * The canvas has pointer-events:none, so document.elementFromPoint returns
     * the real element under the cursor. Stars only react when the cursor is
     * over EMPTY BACKGROUND — the moment it's over anything the user can see or
     * read (text, headings, buttons, links, cards, images, media, form fields)
     * gravity switches off, so hovering a paragraph never drags stars around.
     *
     * Two independent checks, either one shields:
     *   1. SHIELD_SELECTOR — explicit content/interactive tags, plus the
     *      `.bento` card surface and any `[data-star-shield]` opt-in.
     *   2. Direct text — the element owns a non-whitespace text node of its
     *      own. This catches arbitrary text wrappers we never listed.
     *
     * HOW TO MODIFY: to let stars react over some element again, either drop it
     * from SHIELD_SELECTOR or mark it `data-star-free` (checked first).
     */
    const SHIELD_SELECTOR =
      'button, a, input, textarea, select, label, [role="button"], .bento, [data-star-shield], ' +
      "h1, h2, h3, h4, h5, h6, p, span, strong, em, li, dt, dd, blockquote, code, pre, " +
      "img, svg, video, picture, figure, iframe, table, form, summary";

    const hasOwnText = (el: Element) => {
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0) {
          return true;
        }
      }
      return false;
    };

    const isShielded = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) return false; // nothing at all under the cursor = bare canvas
      if (el.closest("[data-star-free]")) return false; // explicit opt-out
      if (el.closest(SHIELD_SELECTOR)) return true;
      return hasOwnText(el);
    };


    // Raw mousemove fires up to ~1000/sec on high-poll mice, and each
    // `isShielded` call is a forced sync layout hit. Coalesce to one check per
    // animation frame.
    let pendingX = -9999;
    let pendingY = -9999;
    let hasPending = false;
    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      hasPending = true;
    };
    const flushMouse = () => {
      if (!hasPending) return;
      hasPending = false;
      if (isShielded(pendingX, pendingY)) {
        mouseRef.current.active = false;
        mouseRef.current.x = -9999;
        mouseRef.current.y = -9999;
        return;
      }
      mouseRef.current.x = pendingX;
      mouseRef.current.y = pendingY;
      mouseRef.current.active = true;
    };
    const onLeave = () => {
      hasPending = false;
      mouseRef.current.active = false;
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };

    const GRAVITY_RADIUS = 140;
    const GRAVITY_STRENGTH = 0.35;
    const SPRING = 0.02;
    const DAMPING = 0.88;
    const CYCLE_SPEED = 0.03; // deg per ms for the light-mode pink cycle

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);

      const isLight = document.documentElement.classList.contains("light");

      if (!perfMode && nebula) {
        ctx.fillStyle = nebula;
        ctx.fillRect(0, 0, width, height);
      }

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const gravityOn = !perfMode && mouseRef.current.active;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        if (!perfMode) {
          s.driftAngle += 0.002;
          const driftX = Math.cos(s.driftAngle) * s.driftRadius;
          const driftY = Math.sin(s.driftAngle * 1.3) * s.driftRadius;
          const targetX = s.ax + driftX;
          const targetY = s.ay + driftY;

          const dx = mx - s.x;
          const dy = my - s.y;
          // squared-distance check first, avoids a sqrt for the ~99% of stars
          // that are nowhere near the cursor.
          const d2 = dx * dx + dy * dy;
          if (gravityOn && d2 < GRAVITY_RADIUS * GRAVITY_RADIUS && d2 > 0.0001) {
            const dist = Math.sqrt(d2);
            const force = (1 - dist / GRAVITY_RADIUS) * GRAVITY_STRENGTH;
            s.vx += (dx / dist) * force;
            s.vy += (dy / dist) * force;
          } else {
            s.vx += (targetX - s.x) * SPRING;
            s.vy += (targetY - s.y) * SPRING;
          }

          s.vx *= DAMPING;
          s.vy *= DAMPING;
          s.x += s.vx;
          s.y += s.vy;
        }

        const twinkle = perfMode
          ? 1
          : 0.55 + 0.45 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset);
        const alpha = s.baseAlpha * twinkle;

        // Sprite draw replaces arc()+fill()+shadowBlur. `r` is a little larger
        // than the old radius because the sprite includes its own soft halo.
        const sprite = isLight
          ? pinkSprites[
              Math.floor(
                (((s.hueOffset + (perfMode ? 0 : t * CYCLE_SPEED)) % 360) / 360) * HUE_BUCKETS,
              ) % HUE_BUCKETS
            ]
          : whiteSprite;
        const r = s.size * (perfMode ? 2.2 : 3.2);
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, s.x - r, s.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    };

    const render = (t: number) => {
      raf = requestAnimationFrame(render);
      // Frame budget cap: on 120/165Hz displays we'd otherwise simulate and
      // paint 2-3x more than needed, stealing main-thread time from scrolling.
      if (t - lastFrame < FRAME_MS) return;
      lastFrame = t;
      flushMouse();
      draw(t);
    };

    resize();

    // In perf mode the field is static, so a resize just needs one repaint.
    const onResize = () => {
      resize();
      if (perfMode) draw(0);
    };
    window.addEventListener("resize", onResize, { passive: true });

    if (!perfMode) {
      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("mouseleave", onLeave, { passive: true });
    }

    // Pause the RAF loop while the tab is hidden.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!perfMode && raf === 0) {
        lastFrame = 0;
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (perfMode) {
      draw(0); // one static frame, no loop at all
    } else {
      raf = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (!perfMode) {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseleave", onLeave);
      }
    };
    // Re-initialising on `optimized` is intentional: perfMode is captured per
    // run, so the toggle must tear down and rebuild the loop.
  }, [optimized]);

  if (skip) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      /* 1. Force the stars background to stay beneath everything */
      className="starfield pointer-events-none fixed inset-0 h-full w-full mix-blend-normal"
      style={{ zIndex: 0 }}
    />
  );
}
