/**
 * WebsitePreviewModal, on-tile-click iframe preview for portfolio websites.
 *
 * Behaviour:
 *   • Fullscreen glass overlay with an iframe of the live site.
 *   • Detects iframe blocking (X-Frame-Options / CSP frame-ancestors) via a
 *     4.5-second load timeout and shows a graceful fallback with an
 *     "Open live site" CTA.
 *   • Analytics: fires a "preview" event on open. The top-bar "Open live
 *     site" button fires a "visit" event. Both are fire-and-forget.
 *
 * Accessibility:
 *   • role="dialog" aria-modal="true" with a labelled title.
 *   • Esc closes; focus is trapped inside the dialog; the Close button gets
 *     initial focus; focus is restored to the trigger element on close.
 *
 * Scroll containment:
 *   • Locks BOTH <html> and <body> scroll (with scrollbar-gutter compensation)
 *     while open so the page underneath cannot scroll — this prevents the
 *     "outer scrollbar + inner scrollbar" bug where the page beneath bled
 *     through when scrolled far enough.
 *   • Overlay uses fully-opaque black (no translucency) as a safety net so
 *     even if a browser skips the lock, nothing shows through.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X, Loader2, ShieldAlert, ArrowLeft } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { logPortfolioClick } from "@/lib/portfolio-clicks.functions";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string;
  title: string;
  subtitle?: string;
  url: string;
  detailHref?: string;
};

export default function WebsitePreviewModal({
  open,
  onClose,
  slug,
  title,
  subtitle,
  url,
  detailHref,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const log = useServerFn(logPortfolioClick);

  // Load-blocking detection.
  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setBlocked(false);
    log({ data: { slug, title, url, kind: "preview" } }).catch(() => {});
    const timer = setTimeout(() => {
      const el = iframeRef.current;
      const stillLoading = !el || !(el as HTMLIFrameElement & { __loaded?: boolean }).__loaded;
      if (stillLoading) setBlocked(true);
    }, 4500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug]);

  // Scroll lock — <html> AND <body>, body fixed-position pinning, and Lenis
  // stop/start. The body pin is the final guard against the old "outer page
  // keeps scrolling under the iframe" bug on desktop trackpads / Brave.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const scrollBarW = window.innerWidth - html.clientWidth;
    const scrollY = window.scrollY;
    const lenis = window.__lenis;
    const shouldRestartLenis = Boolean(lenis && !lenis.isStopped);
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyTouchAction: body.style.touchAction,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
    };
    lenis?.stop();
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    if (scrollBarW > 0) body.style.paddingRight = `${scrollBarW}px`;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.touchAction = "none";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscrollBehavior;
      body.style.overflow = prev.bodyOverflow;
      body.style.paddingRight = prev.bodyPaddingRight;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.touchAction = prev.bodyTouchAction;
      body.style.overscrollBehavior = prev.bodyOverscrollBehavior;
      window.scrollTo(0, scrollY);
      if (shouldRestartLenis) lenis?.start();
    };
  }, [open]);

  // Esc-to-close + focus trap + focus restore.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Defer so the dialog is mounted before we focus.
    const raf = requestAnimationFrame(() => closeBtnRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      // Return focus to the trigger element (the tile) for keyboard users.
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const visit = () => {
    log({ data: { slug, title, url, kind: "visit" } }).catch(() => {});
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const titleId = `preview-title-${slug}`;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      // Fully-opaque so nothing behind can ever bleed through.
      className="fixed inset-0 z-[9999] flex flex-col bg-black animate-in fade-in duration-200"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/80 px-3 py-3 text-white sm:gap-3 sm:px-4">
        <Button
          type="button"
          onClick={onClose}
          variant="ghost"
          className="h-auto rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-white hover:bg-white/20 hover:text-white"
          aria-label="Back to Never Galaxy"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden xs:inline sm:inline">Back to Never Galaxy</span>
          <span className="xs:hidden sm:hidden">Back</span>
        </Button>
        <div className="min-w-0 flex-1">
          <p id={titleId} className="truncate font-display uppercase text-sm tracking-wide">
            {title}
          </p>
          {subtitle && <p className="truncate text-[11px] text-white/50">{subtitle}</p>}
        </div>
        {detailHref && (
          <a
            href={detailHref}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-wider transition hover:bg-white/10"
          >
            Case study →
          </a>
        )}
        {/* Explicit "Open live site" — clarified label so keyboard/SR users
            know this opens the site in a new tab without closing the modal. */}
        <Button
          type="button"
          onClick={visit}
          aria-label={`Open ${title} live site in a new tab`}
          className="h-auto rounded-full bg-white/95 px-3 py-1.5 text-xs uppercase tracking-wider text-black hover:bg-white hover:text-black"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Open live site</span>
          <span className="sm:hidden">Open</span>
        </Button>
        <Button
          ref={closeBtnRef}
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {/* Frame stage */}
      <div className="relative flex-1 overflow-hidden bg-neutral-900">
        {!loaded && !blocked && (
          <div className="absolute inset-0 grid place-items-center text-white/70">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              <p className="text-xs uppercase tracking-widest text-white/50">Loading preview…</p>
            </div>
          </div>
        )}
        {blocked ? (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/80 backdrop-blur">
              <ShieldAlert className="mx-auto h-8 w-8 text-yellow-300" aria-hidden />
              <h3 className="mt-4 font-display uppercase text-lg text-white">
                Preview blocked by the site
              </h3>
              <p className="mt-2 text-sm text-white/60">
                {title} disallows embedding for security. Open the live site in a
                new tab to view it.
              </p>
              <Button
                type="button"
                onClick={visit}
                className="mt-5 h-auto rounded-full bg-white px-4 py-2 text-xs uppercase tracking-widest text-black hover:bg-white/90 hover:text-black"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Open {title}
              </Button>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            title={`${title} preview`}
            className="h-full w-full border-0 bg-white"
            loading="lazy"
            onLoad={(e) => {
              (e.currentTarget as HTMLIFrameElement & { __loaded?: boolean }).__loaded = true;
              setLoaded(true);
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
