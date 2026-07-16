// @ts-nocheck
/**
 * useCanvasCursor — silky wavy multi-line cursor trail.
 *
 * Renders 20 spring-coupled polylines that follow the cursor with slightly
 * varied spring/friction values. Stroke hue slowly oscillates via a sine
 * oscillator, producing a continuous shimmering ribbon on `#canvas`.
 *
 * Mount by rendering <canvas id="canvas" /> once and calling this hook.
 */
import { useEffect } from 'react';

function supportsDesktopCursor() {
  if (typeof window === 'undefined') return false;
  // Match the a11y gate used by StarfieldBackground / useInteractiveCards —
  // users who opted into reduced motion should NOT get the ribbon trail
  // (previously this was the only decorative effect that ignored the OS
  // preference).
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return (
    window.innerWidth >= 1024 &&
    window.matchMedia('(pointer: fine)').matches &&
    window.matchMedia('(hover: hover)').matches &&
    !(navigator.maxTouchPoints > 0) &&
    !('ontouchstart' in window)
  );
}

const useCanvasCursor = () => {
  function n(e) {
    this.init(e || {});
  }
  n.prototype = {
    init: function (e) {
      this.phase = e.phase || 0;
      this.offset = e.offset || 0;
      this.frequency = e.frequency || 0.001;
      this.amplitude = e.amplitude || 1;
    },
    update: function () {
      return (
        (this.phase += this.frequency),
        (e = this.offset + Math.sin(this.phase) * this.amplitude)
      );
    },
    value: function () {
      return e;
    },
  };

  function Line(e) {
    this.init(e || {});
  }

  Line.prototype = {
    init: function (e) {
      this.spring = e.spring + 0.1 * Math.random() - 0.02;
      this.friction = E.friction + 0.01 * Math.random() - 0.002;
      this.nodes = [];
      for (var t, n = 0; n < E.size; n++) {
        t = new Node();
        t.x = pos.x;
        t.y = pos.y;
        this.nodes.push(t);
      }
    },
    update: function () {
      var e = this.spring,
        t = this.nodes[0];
      t.vx += (pos.x - t.x) * e;
      t.vy += (pos.y - t.y) * e;
      for (var n, i = 0, a = this.nodes.length; i < a; i++)
        ((t = this.nodes[i]),
          0 < i &&
            ((n = this.nodes[i - 1]),
            (t.vx += (n.x - t.x) * e),
            (t.vy += (n.y - t.y) * e),
            (t.vx += n.vx * E.dampening),
            (t.vy += n.vy * E.dampening)),
          (t.vx *= this.friction),
          (t.vy *= this.friction),
          (t.x += t.vx),
          (t.y += t.vy),
          (e *= E.tension));
    },
    draw: function () {
      var e,
        t,
        n = this.nodes[0].x,
        i = this.nodes[0].y;
      ctx.beginPath();
      ctx.moveTo(n, i);
      for (var a = 1, o = this.nodes.length - 2; a < o; a++) {
        e = this.nodes[a];
        t = this.nodes[a + 1];
        n = 0.5 * (e.x + t.x);
        i = 0.5 * (e.y + t.y);
        ctx.quadraticCurveTo(e.x, e.y, n, i);
      }
      e = this.nodes[a];
      t = this.nodes[a + 1];
      ctx.quadraticCurveTo(e.x, e.y, t.x, t.y);
      ctx.stroke();
      ctx.closePath();
    },
  };

  function onMousemove(e) {
    function o() {
      lines = [];
      for (var e = 0; e < E.trails; e++)
        lines.push(new Line({ spring: 0.4 + (e / E.trails) * 0.025 }));
    }
    function c(e) {
      e.touches
        ? ((pos.x = e.touches[0].pageX), (pos.y = e.touches[0].pageY))
        : ((pos.x = e.clientX), (pos.y = e.clientY));
    }
    function l(e) {
      1 == e.touches.length &&
        ((pos.x = e.touches[0].pageX), (pos.y = e.touches[0].pageY));
    }
    document.removeEventListener('mousemove', onMousemove);
    document.removeEventListener('touchstart', onMousemove);
    document.addEventListener('mousemove', c);
    // Touch listeners intentionally stay disabled; the cursor ribbon is a
    // desktop-only effect and should never wake up from taps on small devices.
    c(e);
    o();
    render();
  }

  function render() {
    if (ctx.running) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      // -----------------------------------------------------------------
      // TRAIL COLOR — cycles WHITE → GOLD → YELLOW → RED → back.
      // The `f` oscillator (see renderCanvas below) sweeps a 0..1 phase;
      // we map that phase into a warm palette. To change palette, edit
      // the `stops` array (must be [r, g, b] tuples, 0..255).
      // -----------------------------------------------------------------
      const stops = [
        [255, 255, 255], // white
        [255, 215, 120], // warm gold
        [255, 230, 90],  // yellow
        [255, 90, 60],   // red-orange
      ];
      const phase = (f.update() % 360) / 360; // 0..1
      const scaled = phase * stops.length;
      const i = Math.floor(scaled) % stops.length;
      const j = (i + 1) % stops.length;
      const t = scaled - Math.floor(scaled);
      const r = Math.round(stops[i][0] * (1 - t) + stops[j][0] * t);
      const g = Math.round(stops[i][1] * (1 - t) + stops[j][1] * t);
      const b = Math.round(stops[i][2] * (1 - t) + stops[j][2] * t);
      ctx.strokeStyle = `rgba(${r},${g},${b},0.22)`;
      ctx.lineWidth = 1;
      for (var e, t2 = 0; t2 < E.trails; t2++) {
        (e = lines[t2]).update();
        e.draw();
      }
      ctx.frame++;
      window.requestAnimationFrame(render);
    }
  }

  function resizeCanvas() {
    ctx.canvas.width = window.innerWidth - 20;
    ctx.canvas.height = window.innerHeight;
  }

  var ctx,
    f,
    e = 0,
    pos = {},
    lines = [],
    E = {
      // ---------------------------------------------------------------
      // TRAIL SHAPE — how long / dense the tail is.
      //   trails  : number of parallel wavy lines (more = fuller ribbon)
      //   size    : number of nodes per line (more = LONGER trail)
      //   friction: 0..1, how quickly nodes settle (lower = snappier)
      //   dampening / tension: spring physics between neighbor nodes
      // ---------------------------------------------------------------
      debug: true,
      friction: 0.5,
      trails: 10,   // was 12 — leaner ribbon
      size: 10,     // was 18 — even SHORTER tail
      dampening: 0.25,
      tension: 0.98,
    };
  function Node() {
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.vx = 0;
  }

  // Refs kept in closure scope so cleanup can remove the exact function
  // references we added (removing an inline arrow does nothing — that was
  // the previous focus/blur leak).
  let onFocus: (() => void) | null = null;
  let onBlur: (() => void) | null = null;
  let onVisibility: (() => void) | null = null;

  const renderCanvas = function () {
    if (!supportsDesktopCursor()) return;
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.running = true;
    ctx.frame = 1;
    f = new n({
      phase: Math.random() * 2 * Math.PI,
      amplitude: 85,
      frequency: 0.0015,
      offset: 285,
    });
    document.addEventListener('mousemove', onMousemove);
    document.body.addEventListener('orientationchange', resizeCanvas);
    window.addEventListener('resize', resizeCanvas, { passive: true });
    onFocus = () => {
      if (!ctx.running) {
        ctx.running = true;
        render();
      }
    };
    onBlur = () => {
      ctx.running = false;
    };
    // Pause the ribbon RAF loop when the tab is hidden — same reasoning as
    // the starfield: no need to burn frames the user can't see.
    onVisibility = () => {
      if (document.hidden) {
        ctx.running = false;
      } else if (!ctx.running) {
        ctx.running = true;
        render();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    resizeCanvas();
  };

  useEffect(() => {
    if (!supportsDesktopCursor()) return;
    renderCanvas();
    return () => {
      if (ctx) ctx.running = false;
      document.removeEventListener('mousemove', onMousemove);
      document.body.removeEventListener('orientationchange', resizeCanvas);
      window.removeEventListener('resize', resizeCanvas);
      if (onFocus) window.removeEventListener('focus', onFocus);
      if (onBlur) window.removeEventListener('blur', onBlur);
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
};

export default useCanvasCursor;
