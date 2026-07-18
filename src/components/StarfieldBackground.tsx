import { useEffect, useRef, useState } from "react";

/**
 * Interactive starfield, WHITE stars over a deep purple/black wash.
 * - Random twinkling + gentle drift around each star's anchor.
 * - Cursor gravity: nearby stars are softly pulled toward the mouse,
 *   then spring back with damping when the cursor moves away.
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
  hueOffset: number; // per-star phase for RGB cycling in light mode (0..360)
};

export function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });

  // MOBILE / TOUCH / SMALL SCREENS: skip the starfield entirely. Fully flat
  // mobile experience, no canvas, no RAF, no cursor listeners.
  //
  // HYDRATION (A.1 fix): initial state MUST match server render. SSR has no
  // `window`, so it always renders the canvas (skip=false). The client then
  // measures viewport in a post-mount effect and flips `skip`, same pattern
  // as CanvasCursor. Prevents React error #418.
  const [skip, setSkip] = useState(false);

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

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCoarseOrSmall =
      window.matchMedia("(max-width: 767px)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches;
    const perfMode = reducedMotion || isCoarseOrSmall;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      // Clamp DPR harder on phones. High-DPR canvas animation is expensive on
      // budget devices; keeping stars crisp enough matters less than scroll FPS.
      dpr = perfMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const density = Math.floor((width * height) / (perfMode ? 9000 : 4200));
      const count = perfMode
        ? Math.min(Math.max(density, 60), 140)
        : Math.min(Math.max(density, 220), 480);
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
     * Cursor-vs-UI shielding:
     * The canvas has pointer-events:none, so document.elementFromPoint returns
     * whatever real UI element is under the cursor. If that element (or any
     * ancestor) is an interactive surface, button, link, form field, or a
     * `.bento` card / `[data-star-shield]` opt-in, we mark the mouse as
     * "shielded" and the render loop skips gravity + drops the cursor influence.
     * HOW TO MODIFY: extend the CSS selector below to shield more surfaces.
     */
    const SHIELD_SELECTOR =
      'button, a, input, textarea, select, label, [role="button"], .bento, [data-star-shield]';

    const isShielded = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      return !!el && !!el.closest(SHIELD_SELECTOR);
    };

    // Raw mousemove events fire up to ~1000/sec on high-poll mice, and each
    // call to `isShielded` runs `document.elementFromPoint`, a forced sync
    // layout hit. Coalesce to one shield check per animation frame: store
    // the latest coords on move, evaluate inside the RAF tick that already
    // runs. Zero behaviour change; big main-thread win on desktop.
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

    resize();
    window.addEventListener("resize", resize, { passive: true });
    if (!perfMode) {
      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("mouseleave", onLeave, { passive: true });
    }

    // Pause the RAF loop while the tab is hidden, a background tab burning
    // 60fps of canvas draws for nothing is a battery/CPU tax and, on some
    // browsers, keeps a "high performance" GPU context alive.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!perfMode && raf === 0) {
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const GRAVITY_RADIUS = 140;
    const GRAVITY_STRENGTH = 0.35;
    const SPRING = 0.02;
    const DAMPING = 0.88;

    const render = (t: number) => {
      // Coalesced pointer shield check runs once per frame instead of per event.
      flushMouse();
      ctx.clearRect(0, 0, width, height);

      /* RGB cycling, active only in LIGHT mode (experimental).
         HOW TO REVERT: delete this block + the `isLight ? ... : ...` in the
         fillStyle/shadowColor below, and the stars are pure white again. */
      const isLight = document.documentElement.classList.contains("light");
      const CYCLE_SPEED = 0.03; // deg per ms, higher = faster rainbow


      if (!perfMode) {
        // Subtle purple nebula wash behind the white stars. Skipped in mobile
        // perf mode because a full-screen radial gradient every frame is costly.
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
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, width, height);
      }

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        s.driftAngle += perfMode ? 0 : 0.002;
        const driftX = Math.cos(s.driftAngle) * s.driftRadius;
        const driftY = Math.sin(s.driftAngle * 1.3) * s.driftRadius;
        const targetX = s.ax + driftX;
        const targetY = s.ay + driftY;

        const dx = mx - s.x;
        const dy = my - s.y;
        const dist = Math.hypot(dx, dy);
        if (!perfMode && mouseRef.current.active && dist < GRAVITY_RADIUS && dist > 0.01) {
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

        const twinkle = perfMode
          ? 1
          : 0.55 + 0.45 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset);
        const alpha = s.baseAlpha * twinkle;

        ctx.beginPath();
        if (isLight) {
          /* Dark-pink cycle: hue oscillates within a narrow pink band
             (~310°–345°, magenta→rose), with low lightness for "dark" pinks.
             HOW TO TWEAK:
             • PINK_CENTER / PINK_RANGE, shift or widen the hue band.
             • Lightness (28–42%), lower = darker, higher = brighter pink.
             • Saturation (85%), lower = dustier, higher = more vivid. */
          const PINK_CENTER = 328;
          const PINK_RANGE = 18;
          const wobble = Math.sin((t * CYCLE_SPEED + s.hueOffset) * (Math.PI / 180));
          const hue = PINK_CENTER + wobble * PINK_RANGE;
          const light = 28 + ((s.hueOffset % 14));
          ctx.fillStyle = `hsla(${hue}, 85%, ${light}%, ${alpha})`;
          ctx.shadowBlur = perfMode ? 0 : 10;
          if (!perfMode) ctx.shadowColor = `hsla(${hue}, 90%, ${light + 10}%, ${alpha * 0.9})`;
        } else {
          // Pure white stars with a soft warm-white glow (dark mode default)
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.shadowBlur = perfMode ? 0 : 8;
          if (!perfMode) ctx.shadowColor = `rgba(230,220,255,${alpha * 0.75})`;
        }
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      if (perfMode) return;
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    // In perfMode we render exactly one frame (no RAF loop). Re-render on
    // resize so the static starfield isn't cleared to blank on rotation.
    if (perfMode) {
      const perfRepaint = () => render(0);
      window.addEventListener("resize", perfRepaint, { passive: true });
      // The main resize handler already fires, so wrap so both paths repaint.
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (!perfMode) {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseleave", onLeave);
      }
    };
  }, []);

  if (skip) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
