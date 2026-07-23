/**
 * WebsitePreviewModal, on-tile-click iframe preview for portfolio websites.
 *
 * Behaviour:
 *   • Opens as a fullscreen glass overlay with a scaled iframe of the live site.
 *   • Detects iframe blocking (X-Frame-Options / CSP frame-ancestors) via a
 *     4-second load timeout. When blocked, shows a graceful fallback panel
 *     with a big "Open live site" CTA.
 *   • Every open logs a "preview" click; the "Visit site" CTA logs a "visit"
 *     click. Both are fire-and-forget so a blocked network never delays UX.
 *   • Loaded lazily (React.lazy) by the Portfolio component so the modal
 *     code + iframe host chrome only ship after the first tile click.
 */
import { useEffect, useRef, useState } from "react";
import { ExternalLink, X, Loader2, ShieldAlert } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { logPortfolioClick } from "@/lib/portfolio-clicks.functions";

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
  const log = useServerFn(logPortfolioClick);

  // Detect frame blocking: if the iframe never fires `load`, assume the target
  // set X-Frame-Options: DENY / CSP frame-ancestors 'none'. 4s is generous.
  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setBlocked(false);
    // Log a preview open (fire-and-forget).
    log({ data: { slug, title, url, kind: "preview" } }).catch(() => {});
    const timer = setTimeout(() => {
      if (!loaded) setBlocked(true);
    }, 4500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug]);

  // Close on Escape + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const visit = () => {
    log({ data: { slug, title, url, kind: "visit" } }).catch(() => {});
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} preview`}
      className="fixed inset-0 z-[9999] flex flex-col bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/50 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display uppercase text-sm tracking-wide">{title}</p>
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
        <button
          type="button"
          onClick={visit}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs uppercase tracking-wider text-black transition hover:bg-white"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Visit site
        </button>
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Frame stage */}
      <div className="relative flex-1 overflow-hidden bg-neutral-900">
        {!loaded && !blocked && (
          <div className="absolute inset-0 grid place-items-center text-white/70">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-xs uppercase tracking-widest text-white/50">Loading preview…</p>
            </div>
          </div>
        )}
        {blocked ? (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/80 backdrop-blur">
              <ShieldAlert className="mx-auto h-8 w-8 text-yellow-300" />
              <h3 className="mt-4 font-display uppercase text-lg text-white">
                Preview blocked by the site
              </h3>
              <p className="mt-2 text-sm text-white/60">
                {title} disallows embedding for security. Open the live site in a
                new tab to view it.
              </p>
              <button
                type="button"
                onClick={visit}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs uppercase tracking-widest text-black transition hover:bg-white/90"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open {title}
              </button>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            title={`${title} preview`}
            className="h-full w-full border-0 bg-white"
            loading="lazy"
            onLoad={() => setLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  );
}
