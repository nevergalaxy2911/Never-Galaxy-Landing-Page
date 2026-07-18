import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";



/* -----------------------------------------------------------------------------
 * CurrencySwitcher, compact glass pill dropdown that lets visitors view all
 * site pricing in their preferred currency. Reads live FX rates from
 * open.er-api.com (see src/lib/fx.functions.ts) with base = INR.
 *
 * HOW TO MODIFY:
 *   - Available currencies + symbols → edit CURRENCIES in useCurrency.tsx.
 *   - Placement: this component is dropped in Nav.tsx (top-right cluster).
 *     To move it elsewhere, import <CurrencySwitcher /> and place it there.
 *   - Look & feel: styles live in the scoped <style> block at the bottom.
 * --------------------------------------------------------------------------- */
export function CurrencySwitcher() {
  const { currency, currencies, setCurrencyCode } = useCurrency();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [query, setQuery] = useState("");
  // activeIndex tracks the keyboard-focused row inside the filtered list.
  // -1 means "nothing highlighted yet" so the first ArrowDown lands on 0.
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Clear the search field every time the panel opens/closes so the next
  // launch always starts fresh. Also seed activeIndex to the current currency.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(-1);
    } else {
      const idx = currencies.findIndex((c) => c.code === currency.code);
      setActiveIndex(idx);
    }
  }, [open, currencies, currency.code]);

  // Track viewport so we can swap the anchored desktop dropdown for a
  // centered mobile modal (dropdowns on tiny triggers always look off-axis).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Close on outside click / Esc. Outside-click check is skipped on mobile
  // because the modal has its own backdrop that owns dismissal.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (isMobile) return;
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    // Lock body scroll while the mobile modal is up.
    if (isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("mousedown", onClick);
        document.body.style.overflow = prev;
      };
    }
    return () => {
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, isMobile]);

  // Filter list by the search query (code / label / symbol, case-insensitive).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currencies;
    return currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q),
    );
  }, [currencies, query]);

  // Reset the highlight to the first row whenever the filtered list changes
  // (e.g., the user types and the previous highlight is no longer visible).
  useEffect(() => {
    if (!open) return;
    setActiveIndex(filtered.length > 0 ? 0 : -1);
  }, [query, filtered.length, open]);

  // Auto-scroll the highlighted row into view.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.querySelectorAll<HTMLElement>("[data-cur-row]")[activeIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // Keyboard nav, bound to the search input and the trigger. Arrow keys move
  // through the FILTERED list, Enter selects, Esc closes and refocuses trigger.
  const onNavKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length === 0 ? -1 : (i + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0 ? -1 : (i - 1 + filtered.length) % filtered.length,
      );
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(filtered.length > 0 ? 0 : -1);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[activeIndex] ?? filtered[0];
      if (pick) {
        setCurrencyCode(pick.code);
        setOpen(false);
      }
    }
  };

  const renderOptions = (list: typeof currencies) =>
    list.map((c, i) => {
      const active = c.code === currency.code;
      const highlighted = i === activeIndex;
      return (
        <li key={c.code}>
          <button
            type="button"
            role="option"
            data-cur-row
            aria-selected={active}
            onMouseEnter={() => setActiveIndex(i)}
            onClick={() => {
              setCurrencyCode(c.code);
              setOpen(false);
            }}
            className={`cur-option ${active ? "is-active" : ""} ${highlighted ? "is-highlight" : ""}`}
          >
            <span className="cur-opt-symbol">{c.symbol.trim()}</span>
            <span className="cur-opt-code">{c.code}</span>
            <span className="cur-opt-label">{c.label}</span>
            {active && <Check className="h-3.5 w-3.5 ml-auto" />}
          </button>
        </li>
      );
    });




  return (
    <div
      ref={rootRef}
      className="relative"
      // data-star-shield: prevents the starfield background from responding
      // to cursor gravity while hovering this control (see StarfieldBackground).
      data-star-shield
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onNavKey}
        className="cur-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change display currency"
      >
        <span className="cur-symbol">{currency.symbol.trim()}</span>
        <span className="cur-code">{currency.code}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>


      {/* Desktop: anchored dropdown centered under the trigger.
          - Outer .cur-anchor owns the horizontal centering (translateX(-50%)).
          - Middle .cur-tilt-host carries the btn-tilt 3D wobble; because tilt
            rotates around this host (not the anchor) and the host has NO
            translate of its own, the panel no longer feels pinned by its
            top-middle corner, the whole card wobbles as one piece.
          - Inner .cur-menu animates a soft fade + scale from its own center. */}
      {open && !isMobile && (
        <div className="cur-anchor">
          <div className="cur-tilt-host btn-tilt">
            <div className="cur-menu">
              <label className="cur-search cur-search--desktop">
                <Search className="h-3.5 w-3.5 opacity-70" aria-hidden />
                <input
                  type="search"
                  inputMode="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onNavKey}
                  placeholder="Search currency…"
                  aria-label="Search currency"
                />
                {query && (
                  <button
                    type="button"
                    className="cur-search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </label>
              <ul
                ref={listRef}
                className="cur-menu-list"
                role="listbox"
                aria-label="Currency"
                data-lenis-prevent
                style={{ overscrollBehavior: "contain" }}
              >
                {filtered.length > 0 ? (
                  renderOptions(filtered)
                ) : (
                  <li className="cur-empty">No matches for “{query}”.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}



      {/* Mobile: centered modal with backdrop, dropdowns on a tiny pill
          trigger always look off-axis on phones, so we escape the flow. */}
      {open && isMobile && (
        <div
          className="cur-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Choose currency"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="cur-modal">
            <div className="cur-modal-head">
              <span className="cur-modal-title">Select currency</span>
              <button
                type="button"
                className="cur-modal-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Search, filters by code, name, or symbol as the user types. */}
            <label className="cur-search">
              <Search className="h-4 w-4 opacity-70" aria-hidden />
              <input
                type="search"
                inputMode="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onNavKey}
                placeholder="Search currency…"
                aria-label="Search currency"
              />

              {query && (
                <button
                  type="button"
                  className="cur-search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <ul
              ref={isMobile ? listRef : undefined}
              className="cur-modal-list"
              role="listbox"
              aria-label="Currency"
              data-lenis-prevent
              style={{ overscrollBehavior: "contain" }}
            >

              {filtered.length > 0 ? (
                renderOptions(filtered)
              ) : (
                <li className="cur-empty">No matches for “{query}”.</li>
              )}
            </ul>
          </div>

        </div>
      )}


      {/* -----------------------------------------------------------------
       * Scoped styles, mirrors the Contact scope-menu glassmorphism so the
       * switcher blends with the site's overall aesthetic. Light-mode
       * overrides at the bottom keep contrast readable on white paper.
       * ----------------------------------------------------------------- */}
      <style>{`
        .cur-trigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 12px;
          border-radius: 9999px;
          border: 1px solid color-mix(in oklab, var(--sec-a) 40%, transparent);
          background: color-mix(in oklab, black 55%, transparent);
          backdrop-filter: blur(10px);
          color: color-mix(in oklab, white 95%, var(--sec-a));
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
        }
        .cur-trigger:hover {
          border-color: color-mix(in oklab, var(--sec-a) 85%, transparent);
          box-shadow: 0 0 22px color-mix(in oklab, var(--sec-a) 50%, transparent);
        }
        .cur-symbol {
          display: inline-grid;
          place-items: center;
          min-width: 16px;
          font-weight: 700;
          color: color-mix(in oklab, var(--sec-a) 40%, white);
        }
        .cur-code { font-weight: 600; }

        /* Anchor wrapper owns the horizontal centering so the animated
           child never overwrites the translateX(-50%) mid-frame. */
        .cur-anchor {
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 60;
          /* Deeper perspective on the parent = softer, less exaggerated 3D. */
          perspective: 1400px;
        }

        /* Tilt host: btn-tilt writes CSS vars --tx/--ty from cursor position.
           We OVERRIDE its transform here so we can:
             - scale the tilt down (0.45x) → subtle instead of aggressive
             - re-declare perspective inline (matches parent, keeps tilt stable)
             - use will-change for GPU compositing → no jank on open/close
           The intro is opacity-only so it never clobbers the live tilt. */
        .cur-tilt-host {
          transform-style: preserve-3d;
          transform-origin: 50% 50%;
          transform:
            perspective(1400px)
            rotateX(calc(var(--tx, 0deg) * 0.45))
            rotateY(calc(var(--ty, 0deg) * 0.45));
          transition: transform 0.5s cubic-bezier(.22,.7,.2,1);
          will-change: transform, opacity;
          animation: cur-menu-in 220ms cubic-bezier(.22,.9,.25,1);
          backface-visibility: hidden;
        }

        .cur-menu {
          display: flex;
          flex-direction: column;
          min-width: 280px;
          max-height: 380px;
          padding: 6px;
          border-radius: 14px;
          border: 1px solid color-mix(in oklab, var(--sec-a) 45%, transparent);
          background: color-mix(in oklab, black 70%, transparent);
          backdrop-filter: blur(18px);
          box-shadow:
            0 20px 60px -20px color-mix(in oklab, var(--sec-a) 60%, transparent),
            0 0 40px color-mix(in oklab, var(--sec-c) 30%, transparent);
        }
        .cur-menu-list {
          list-style: none;
          margin: 0;
          padding: 2px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: color-mix(in oklab, var(--sec-a) 55%, transparent) transparent;
        }
        .cur-menu-list::-webkit-scrollbar { width: 6px; }
        .cur-menu-list::-webkit-scrollbar-track { background: transparent; }
        .cur-menu-list::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg,
            color-mix(in oklab, var(--sec-a) 70%, transparent),
            color-mix(in oklab, var(--sec-c) 70%, transparent));
          border-radius: 9999px;
        }
        .cur-menu-list::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, var(--sec-a), var(--sec-c));
        }
        /* Compact search inside the desktop dropdown. */
        .cur-search--desktop {
          margin: 4px 4px 6px;
          padding: 6px 8px;
          font-size: 12px;
        }
        .cur-search--desktop input { font-size: 12px; }

        /* Opacity-only intro, animating transform would clobber btn-tilt. */
        @keyframes cur-menu-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* Reduced motion: kill tilt + animations + smooth-scroll on the panel
           entirely. The dropdown snaps in place and stays flat. */
        @media (prefers-reduced-motion: reduce) {
          .cur-tilt-host {
            animation: none !important;
            transform: none !important;
            transition: none !important;
          }
          .cur-menu, .cur-modal, .cur-modal-backdrop {
            animation: none !important;
          }
          .cur-option { transition: none !important; }
        }



        /* Mobile modal, full-viewport backdrop + centered sheet. */
        .cur-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 20px;
          background: color-mix(in oklab, black 65%, transparent);
          backdrop-filter: blur(6px);
          animation: cur-fade-in 160ms ease;
        }
        .cur-modal {
          width: 100%;
          max-width: 340px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          border-radius: 18px;
          border: 1px solid color-mix(in oklab, var(--sec-a) 50%, transparent);
          background: color-mix(in oklab, black 75%, transparent);
          backdrop-filter: blur(22px);
          box-shadow:
            0 30px 80px -20px color-mix(in oklab, var(--sec-a) 60%, transparent),
            0 0 60px color-mix(in oklab, var(--sec-c) 30%, transparent);
          animation: cur-modal-in 200ms cubic-bezier(.2,.7,.2,1);
        }
        .cur-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
          border-bottom: 1px solid color-mix(in oklab, var(--sec-a) 25%, transparent);
        }
        .cur-modal-title {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: color-mix(in oklab, white 90%, var(--sec-a));
        }
        .cur-modal-close {
          display: inline-grid;
          place-items: center;
          height: 30px;
          width: 30px;
          border-radius: 9999px;
          border: 1px solid color-mix(in oklab, var(--sec-a) 40%, transparent);
          background: transparent;
          color: color-mix(in oklab, white 90%, var(--sec-a));
          cursor: pointer;
        }
        .cur-search {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 10px 12px 6px;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid color-mix(in oklab, var(--sec-a) 35%, transparent);
          background: color-mix(in oklab, black 40%, transparent);
          color: color-mix(in oklab, white 90%, var(--sec-a));
        }
        .cur-search input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: 0;
          outline: 0;
          color: inherit;
          font-size: 13px;
          font-family: inherit;
        }
        .cur-search input::placeholder {
          color: color-mix(in oklab, white 55%, var(--sec-a));
        }
        .cur-search-clear {
          display: inline-grid;
          place-items: center;
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          border: 0;
          background: color-mix(in oklab, var(--sec-a) 25%, transparent);
          color: inherit;
          cursor: pointer;
        }
        .cur-modal-list {
          list-style: none;
          margin: 0;
          padding: 8px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: color-mix(in oklab, var(--sec-a) 55%, transparent) transparent;
        }
        .cur-empty {
          padding: 18px 12px;
          text-align: center;
          font-size: 12px;
          color: color-mix(in oklab, white 65%, var(--sec-a));
        }

        @keyframes cur-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cur-modal-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }


        .cur-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 10px;
          border-radius: 10px;
          background: transparent;
          border: 0;
          color: color-mix(in oklab, white 85%, var(--sec-a));
          font-size: 12px;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .cur-option:hover {
          background: color-mix(in oklab, var(--sec-a) 22%, transparent);
          color: white;
        }
        .cur-option.is-active {
          background: color-mix(in oklab, var(--sec-a) 30%, transparent);
          color: white;
        }
        /* Keyboard-highlighted row, a bold, unmistakable ring + glow so users
           can track the ArrowUp/ArrowDown position at a glance. Uses ring +
           inset accent bar + brighter bg, all layered so it wins over hover. */
        .cur-option.is-highlight {
          background: color-mix(in oklab, var(--sec-a) 34%, transparent);
          color: white;
          box-shadow:
            inset 3px 0 0 0 var(--sec-a),
            0 0 0 2px color-mix(in oklab, var(--sec-a) 70%, transparent),
            0 0 18px -2px color-mix(in oklab, var(--sec-a) 55%, transparent);
        }
        .cur-option:focus-visible {
          outline: 2px solid var(--sec-a);
          outline-offset: 2px;
        }


        .cur-opt-symbol {
          display: inline-grid;
          place-items: center;
          min-width: 22px;
          font-weight: 700;
          color: color-mix(in oklab, var(--sec-a) 40%, white);
        }
        .cur-opt-code {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 10.5px;
          letter-spacing: 0.1em;
          min-width: 34px;
          opacity: 0.85;
        }
        .cur-opt-label { flex: 1; }

        /* Light mode, dark ink on soft tinted paper for legibility. */
        .light .cur-trigger {
          background: color-mix(in oklab, var(--sec-a) 8%, white);
          border-color: color-mix(in oklab, var(--sec-a) 55%, black);
          color: color-mix(in oklab, var(--sec-a) 90%, black);
        }
        .light .cur-trigger:hover {
          background: color-mix(in oklab, var(--sec-a) 18%, white);
        }
        .light .cur-symbol,
        .light .cur-opt-symbol {
          color: color-mix(in oklab, var(--sec-a) 80%, black);
        }
        .light .cur-menu,
        .light .cur-modal {
          background: color-mix(in oklab, var(--sec-a) 6%, white);
          border-color: color-mix(in oklab, var(--sec-a) 40%, black);
          box-shadow: 0 20px 60px -20px color-mix(in oklab, var(--sec-a) 40%, transparent);
        }
        .light .cur-modal-title,
        .light .cur-modal-close {
          color: color-mix(in oklab, var(--sec-a) 90%, black);
        }

        .light .cur-option {
          color: color-mix(in oklab, var(--sec-a) 85%, black);
        }
        .light .cur-option:hover,
        .light .cur-option.is-active {
          background: color-mix(in oklab, var(--sec-a) 20%, white);
          color: color-mix(in oklab, var(--sec-a) 95%, black);
        }
      `}</style>
    </div>
  );
}
