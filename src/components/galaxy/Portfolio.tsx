import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Play, ImageIcon, Sparkles, Globe, Video, Camera, Palette, Music, Mic, Layers, ExternalLink } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import type { VideoItem, GraphicItem } from "@/types/portfolio";
import type { PublicPortfolioItem } from "@/lib/public-data.functions";
import {
  DEFAULT_CATEGORIES,
  type PortfolioCategory,
} from "@/lib/portfolio-config";
import { listPortfolioSites, type PortfolioSite } from "@/config/portfolio-sites";
import { PORTFOLIO } from "@/config/site";

import { logPortfolioClick } from "@/lib/portfolio-clicks.functions";
import { useProgressiveImage, warmImageCache, noteImageLoaded, markImageDecoded } from "@/lib/imageCache";
import { screenshotTier } from "@/lib/deviceTier";

// Lazy-load the preview modal so its iframe host chrome stays out of the LCP
// path, but expose the loader so Website-tab intent can warm the chunk before
// the actual click. This removes the click-to-modal JavaScript wait.
const loadWebsitePreviewModal = () => import("./WebsitePreviewModal");
const WebsitePreviewModal = lazy(loadWebsitePreviewModal);

/* -----------------------------------------------------------------------------
 * PORTFOLIO, bento gallery with ADMIN-EDITABLE FILTER TABS.
 *
 * TAB BAR — categories come from /admin → Filters (site_settings row
 * `portfolio.categories`). Falls back to DEFAULT_CATEGORIES if the DB is
 * empty or unreachable so the section always renders. Each category has a
 * `kind`: "video" renders a YouTube-facade tile (needs a YouTube URL in the
 * row's `url`); "image" renders an image tile (uses `thumb_url` or `url`).
 * Toggling `enabled=false` in the admin hides the tab immediately.
 *
 * TILE DATA — `liveItems` (from getPublicPortfolio) is grouped by
 * `item.category` matching a category `id`. When empty, we fall back to
 * static placeholder tiles (STATIC_FALLBACK) so the layout doesn't collapse.
 *
 * LAYOUT — bento spans cycle through a preset pattern so any row count
 * fills the 6-col grid cleanly. This matches the OG design exactly.
 * --------------------------------------------------------------------------- */

// Lucide icon map — keep in sync with ICON_CHOICES in portfolio-config.ts
const ICONS: Record<string, typeof Play> = {
  Play, Sparkles, ImageIcon, Globe, Video, Camera, Palette, Music, Mic, Layers,
};

const SPAN_CYCLE = [
  "md:col-span-4 md:row-span-2",
  "md:col-span-2",
  "md:col-span-2",
  "md:col-span-3",
  "md:col-span-3",
];

// Static placeholder tiles per category kind, shown when a category has zero
// live rows so the section never looks empty on a fresh deploy.
const STATIC_VIDEO_FALLBACK: VideoItem[] = [
  { id: "sv1", title: "Your next edit lands here", kind: "Add via /admin", span: SPAN_CYCLE[0] },
  { id: "sv2", title: "Brand film",                kind: "Coming soon",    span: SPAN_CYCLE[1] },
  { id: "sv3", title: "Short-form reel",           kind: "Coming soon",    span: SPAN_CYCLE[2] },
  { id: "sv4", title: "Long-form cut",             kind: "Coming soon",    span: SPAN_CYCLE[3] },
  { id: "sv5", title: "Launch trailer",            kind: "Coming soon",    span: SPAN_CYCLE[4] },
];
const STATIC_IMAGE_FALLBACK: GraphicItem[] = [
  { id: "sg1", title: "Featured design",  kind: "Add via /admin", span: SPAN_CYCLE[0] },
  { id: "sg2", title: "Poster",           kind: "Coming soon",    span: SPAN_CYCLE[1] },
  { id: "sg3", title: "Cover art",        kind: "Coming soon",    span: SPAN_CYCLE[2] },
  { id: "sg4", title: "Social carousel",  kind: "Coming soon",    span: SPAN_CYCLE[3] },
  { id: "sg5", title: "Brand mark",       kind: "Coming soon",    span: SPAN_CYCLE[4] },
];

// Browser-level origin warm-up for iframe previews. We keep this tiny and
// idempotent: DNS prefetch is cheap for every site; preconnect only happens on
// real intent so six external projects do not compete with the first paint.
const warmedOrigins = new Set<string>();

function warmWebsiteOrigins(urls: Array<string | undefined>, connect = false) {
  if (typeof document === "undefined") return;
  urls.forEach((url) => {
    if (!url) return;
    try {
      const origin = new URL(url).origin;
      const key = `${connect ? "preconnect" : "dns"}:${origin}`;
      if (warmedOrigins.has(key)) return;
      warmedOrigins.add(key);
      const link = document.createElement("link");
      link.rel = connect ? "preconnect" : "dns-prefetch";
      link.href = origin;
      if (connect) link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    } catch {
      /* Invalid admin-entered URL, ignore and let the normal click path handle it. */
    }
  });
}

// Live shipped websites — showcased under the "Website" tab. Order + copy
// live in `src/config/portfolio-sites.ts` (single source of truth, also
// powers the /work/<slug> detail pages). The first `featured` entry (else
// the first entry) claims the biggest bento tile.
const FEATURED_WEBSITES: (GraphicItem & { slug: string; liveUrl: string })[] = (() => {
  const sites = listPortfolioSites();
  const featuredIdx = Math.max(0, sites.findIndex((s) => s.featured));
  return sites.map((s, i) => ({
    id: `web-${s.slug}`,
    slug: s.slug,
    title: s.title,
    kind: s.subtitle,
    // Homepage tiles use purpose-made WebP shots instead of the original PNGs:
    // desktop tile ≈12-26KB, mobile tile ≈13-23KB, blur placeholder <1KB.
    src: s.tileSrc,
    srcMobile: s.tileMobileSrc,
    placeholderSrc: s.blurSrc,
    previewSrc: s.detailDesktopSrc,
    href: s.liveUrl,
    liveUrl: s.liveUrl,
    // Featured entry gets the hero span; others cycle through the remaining
    // spans in order so the bento stays visually balanced.
    span: i === featuredIdx ? SPAN_CYCLE[0] : SPAN_CYCLE[1 + ((i < featuredIdx ? i : i - 1) % (SPAN_CYCLE.length - 1))],
  }));
})();

function pickSpan(i: number): string {
  return SPAN_CYCLE[i % SPAN_CYCLE.length];
}

type PreviewTarget = {
  slug: string;
  title: string;
  subtitle?: string;
  url: string;
  detailHref?: string;
  previewImage?: string;
};

function isWebsiteCategory(category?: PortfolioCategory) {
  if (!category) return false;
  const id = category.id.toLowerCase();
  const label = category.label.toLowerCase();
  return id === "web" || id === "website" || id.includes("website") || label === "website";
}

export function Portfolio({
  liveItems,
  categories,
}: {
  liveItems?: PublicPortfolioItem[];
  categories?: PortfolioCategory[];
}) {
  const cats = useMemo(
    () => (categories?.length ? categories : DEFAULT_CATEGORIES).filter((c) => c.enabled),
    [categories],
  );
  const [tab, setTab] = useState<string>(() => cats[0]?.id ?? "video");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const activeCat = cats.find((c) => c.id === tab) ?? cats[0];
  const activeIsWebsite = isWebsiteCategory(activeCat);

  /* AUTOMATIC PRE-RENDER — every website screenshot is pulled into the
   * on-device cache as soon as the site opens, so the Website tab paints
   * instantly the first time it is opened (no manual "warm now" button).
   *
   * ORDER OF WORK (deliberate, so it never fights the first paint):
   *   1. wait one frame + a short beat so the hero/LCP finishes painting,
   *   2. fetch everything immediately in small parallel batches,
   *   3. keep the idle warm-up as a safety net for anything left over.
   *
   * ADAPTIVE: low-tier devices only cache the small shots — they never render
   * the full-resolution ones, so storing them would be pure waste.
   * HOW TO MODIFY: see warmImageCacheNow / warmImageCache in lib/imageCache.ts. */
  useEffect(() => {
    const low = screenshotTier() === "low";
    const srcs = FEATURED_WEBSITES.flatMap((w) =>
      low ? [w.placeholderSrc, w.srcMobile] : [w.placeholderSrc, w.srcMobile, w.src, w.previewSrc],
    );
    let cancelIdle: () => void = () => {};
    let alive = true;

    // Cheap DNS warm-up for the live preview origins. Actual connections wait
    // for pointer/focus intent so the home page stays light.
    warmWebsiteOrigins(FEATURED_WEBSITES.map((w) => w.liveUrl), false);

    /* STEP 1 — decode into the BROWSER's own image cache right away. This is
     * the bit that makes the Website filter paint instantly: by the time the
     * tab is clicked the bytes are already decoded, so the <img> is a cache
     * hit with no network round-trip. The optimized tile WebPs are tiny, so
     * this is safe on both phones and desktops. */
    const preloaded = srcs.filter(Boolean).map((s) => {
      const img = new Image();
      img.decoding = "async";
      img.fetchPriority = "high";
      img.src = s as string;
      // Register the shot as decoded so tiles mounted later (i.e. when the
      // visitor switches to the Website filter) paint the sharp image on the
      // very first frame instead of blurring up from the small one.
      const mark = () => markImageDecoded(s as string);
      if (img.decode) img.decode().then(mark, () => {});
      else img.onload = mark;
      return img;
    });


    /* STEP 2 — persist them to on-device storage for the NEXT visit. Deferred
     * one frame so it never competes with the hero paint. */
    const t = window.setTimeout(() => {
      void import("@/lib/imageCache").then(async ({ warmImageCacheNow }) => {
        await warmImageCacheNow(srcs);
        if (alive) cancelIdle = warmImageCache(srcs);
      });
    }, 400);
    return () => {
      alive = false;
      preloaded.forEach((img) => {
        img.src = "";
      });
      window.clearTimeout(t);
      cancelIdle();
    };
  }, []);

  /* INTENT PREFETCH — warm a tab's imagery the instant the visitor shows they
   * are about to open it. Runs at most once per tab (prefetchedTabs). */
  const prefetchedTabs = useRef<Set<string>>(new Set());
  const prefetchTab = useCallback((id: string) => {
    const category = cats.find((c) => c.id === id);
    if (!isWebsiteCategory(category) || prefetchedTabs.current.has(id)) return;
    prefetchedTabs.current.add(id);
    const low = screenshotTier() === "low";
    const srcs = FEATURED_WEBSITES.flatMap((w) =>
      low ? [w.placeholderSrc, w.srcMobile] : [w.placeholderSrc, w.srcMobile, w.src, w.previewSrc],
    );
    warmWebsiteOrigins(FEATURED_WEBSITES.map((w) => w.liveUrl), true);
    void loadWebsitePreviewModal();
    void import("@/lib/imageCache").then(({ warmImageCacheNow }) => warmImageCacheNow(srcs));
  }, [cats]);

  const head = useReveal<HTMLDivElement>(0);
  const grid = useReveal<HTMLDivElement>(120);

  // Group live items by category id.
  const grouped = useMemo(() => {
    const g: Record<string, PublicPortfolioItem[]> = {};
    if (liveItems) for (const it of liveItems) (g[it.category] ??= []).push(it);
    return g;
  }, [liveItems]);

  if (!activeCat) return null;

  const rows = activeIsWebsite ? [] : grouped[activeCat.id] ?? [];
  const videos: VideoItem[] = rows.length
    ? rows.map((it, i) => ({
        id: it.id,
        title: it.title,
        kind: it.subtitle || activeCat.label,
        youtubeId: it.youtubeId,
        span: pickSpan(i),
      }))
    : activeCat.kind === "video"
      ? STATIC_VIDEO_FALLBACK
      : [];
  const graphics: GraphicItem[] = rows.length
    ? rows.map((it, i) => ({
        id: it.id,
        title: it.title,
        kind: it.subtitle || activeCat.label,
        src: it.thumbUrl || it.url,
        href: it.url && /^https?:\/\//.test(it.url) ? it.url : undefined,
        span: pickSpan(i),
      }))
    : activeCat.kind === "image"
      ? activeIsWebsite
        ? FEATURED_WEBSITES
        : STATIC_IMAGE_FALLBACK
      : [];

  return (
    <section id="portfolio" className="sec-plum nebula-wash relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div ref={head} className="reveal flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <span className="label-chip">02 · Work</span>
            <h2 className="mt-6 font-display uppercase text-[clamp(2rem,5vw,4rem)]">
              A <span className="text-gradient-nebula">portfolio</span> in orbit.
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              A rotating showcase of the work we ship, video edits, motion
              pieces, and graphics. Hover a tile, hit play.
            </p>
          </div>

          {/* Filter tabs — driven by admin-editable categories list.
              Mobile: horizontal scroll with snap so pills never wrap.
              Tablet+: wrap as a centered pill bar. */}
          <div className="portfolio-tabs w-full self-center overflow-hidden md:w-fit md:max-w-full md:self-end">
            <div className="portfolio-tab-list flex flex-nowrap snap-x gap-1 overflow-x-auto md:justify-center">
              {cats.map((c) => {
                const Icon = ICONS[c.icon] ?? ImageIcon;
                return (
                  <button
                    key={c.id}
                    onClick={() => setTab(c.id)}
                    /* PREFETCH ON INTENT — the moment a pointer touches the
                       Website pill (or a finger lands on it) we pull that tab's
                       screenshots into the cache, so switching tabs paints
                       instantly instead of starting a fetch on click.
                       HOW TO MODIFY: see warmImageCacheNow in lib/imageCache.ts. */
                    onPointerEnter={() => prefetchTab(c.id)}
                    onPointerDown={() => prefetchTab(c.id)}
                    onFocus={() => prefetchTab(c.id)}
                    data-active={tab === c.id}
                    className="portfolio-tab inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-mono uppercase tracking-wider transition-all sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-widest"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        <div ref={grid} className="reveal mt-14 grid grid-cols-1 md:grid-cols-6 auto-rows-[minmax(200px,auto)] gap-4">
          {activeCat.kind === "video" && videos.map((v) => <VideoTile key={v.id} item={v} />)}
          {activeCat.kind === "image" && graphics.map((g) => (
            <GraphicTile
              key={g.id}
              item={g}
              isWebsite={activeIsWebsite}
              onPreview={activeIsWebsite ? (site) => setPreview(site) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Lazy-mounted iframe preview modal — only reachable from Website tiles. */}
      {preview && (
        <Suspense fallback={null}>
          <WebsitePreviewModal
            open={!!preview}
            onClose={() => setPreview(null)}
            slug={preview.slug}
            title={preview.title}
            subtitle={preview.subtitle}
            url={preview.url}
            detailHref={preview.detailHref}
            previewImage={preview.previewImage}
          />
        </Suspense>
      )}
    </section>
  );
}

/* ---------- Video tile: YouTube facade ---------- */
function VideoTile({ item }: { item: VideoItem }) {
  const [playing, setPlaying] = useState(false);
  return (
    <article className={`bento overflow-hidden flex flex-col ${item.span}`}>
      <div className="relative flex-1 min-h-[180px] tile-surface">
        {item.youtubeId ? (
          playing ? (
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${item.youtubeId}?rel=0&modestbranding=1&autoplay=1`}
              title={item.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play ${item.title}`}
              className="group absolute inset-0 h-full w-full overflow-hidden"
            >
              <img
                src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
                alt=""
                width={480}
                height={360}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/10">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-black shadow-2xl transition-transform group-hover:scale-110">
                  <Play className="h-6 w-6 translate-x-[2px]" fill="currentColor" />
                </span>
              </span>
            </button>
          )
        ) : (
          <ComingSoonSurface icon={<Play className="h-8 w-8" />} label="YouTube URL slot" />
        )}
      </div>
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display uppercase text-lg truncate">{item.title}</h3>
          <p className="label-mono mt-1">{item.kind}</p>
        </div>
        <span className="label-mono text-[9px] opacity-70 shrink-0">{item.youtubeId ? "Play" : "Soon"}</span>
      </div>
    </article>
  );
}

/* ---------- Graphic tile: image, external link, or website preview ---------- */
function GraphicTile({
  item,
  isWebsite,
  onPreview,
}: {
  item: GraphicItem;
  isWebsite?: boolean;
  onPreview?: (t: PreviewTarget) => void;
}) {
  const logClick = useServerFn(logPortfolioClick);
  const clickable = Boolean(item.href);
  const slug = item.id.startsWith("web-") ? item.id.slice(4) : item.id;

  // MAISON AURELIA (and any future portrait / letterboxed site shot) needs
  // `object-contain` so the left edge isn't cropped. All other tiles keep
  // `object-cover` for the immersive edge-to-edge look.
  const useContain = slug === "maison-aurelia";
  const imgFit = useContain ? "object-contain" : "object-cover";

  // Screenshots are persisted to localStorage after their first paint (see
  // lib/imageCache.ts), so repeat visits show the tile instantly with no
  // request at all. Falls back to the network URL whenever nothing is stored.
  // Screenshots are persisted to localStorage after their first paint (see
  // lib/imageCache.ts), so repeat visits show the tile instantly with no
  // request at all. PROGRESSIVE: the small mobile shot paints first and the
  // full-resolution one swaps in once decoded — and on Data Saver / low-end
  // devices the small shot is kept as the final image (adaptive scaling).
  // Website tiles are already tiny WebP files, so they bypass the localStorage
  // screenshot hook completely. That keeps filter switching on the browser's
  // native memory cache path with no synchronous storage reads.
  const progressive = useProgressiveImage(isWebsite ? undefined : item.src, isWebsite ? undefined : item.srcMobile);
  const imgSrc = isWebsite ? item.src : progressive.src;
  const isFinal = isWebsite || progressive.isFinal;
  const isCached = !isWebsite && progressive.isCached;

  // Reference point for the "last rendered" figure in the diagnostics panel.
  const [mountedAt] = useState(() => (typeof performance !== "undefined" ? performance.now() : 0));

  // Preview modal is a DESKTOP-ONLY experience by default — mobile iframes
  // are cramped and most target sites block embedding on small viewports
  // anyway. The breakpoint is admin-tunable via PORTFOLIO.previewBreakpointPx
  // in src/config/site.ts. Below the threshold, the tile opens the live site
  // in a new tab.
  const isDesktopViewport = () =>
    typeof window !== "undefined" &&
    window.matchMedia(`(min-width: ${PORTFOLIO.previewBreakpointPx}px)`).matches;

  const openPreview = () => {
    if (!clickable || !isWebsite) return;
    const desktop = isDesktopViewport();
    warmWebsiteOrigins([item.href], true);
    // Analytics: tap on mobile → "visit" (opens live), click on desktop → "tile"
    // (opens the modal; the modal itself also fires a "preview" event on open).
    const kind: "tile" | "visit" = desktop ? "tile" : "visit";
    logClick({ data: { slug, title: item.title, url: item.href!, kind } }).catch(() => {});
    if (!desktop || !onPreview) {
      window.open(item.href!, "_blank", "noopener,noreferrer");
      return;
    }
    onPreview({
      slug,
      title: item.title,
      subtitle: item.kind,
      url: item.href!,
      detailHref: `/work/${slug}`,
      previewImage: item.previewSrc || item.src,
    });
  };

  // Website tiles → button that opens the modal (desktop) or a new tab
  // (mobile/tablet). Other clickable tiles → plain anchor.
  const Wrapper: React.ElementType = isWebsite && clickable ? "button" : clickable ? "a" : "article";
  const wrapperProps: Record<string, unknown> = isWebsite && clickable
    ? {
        type: "button",
        onClick: openPreview,
        onPointerEnter: () => warmWebsiteOrigins([item.href], true),
        onFocus: () => warmWebsiteOrigins([item.href], true),
        "aria-label": `${item.title}: opens live site in a new tab on mobile, or in an in-page preview on desktop`,
      }
    : clickable
      ? {
          href: item.href,
          target: "_blank",
          rel: "noopener noreferrer",
          "aria-label": `${item.title}: open in a new tab`,
        }
      : {};




  return (
    <Wrapper
      {...wrapperProps}
      className={`bento group overflow-hidden flex flex-col text-left ${item.span} ${clickable ? "cursor-pointer" : ""}`}
    >
      <div className="relative flex-1 min-h-[200px] tile-surface overflow-hidden">
        {item.src ? (
          <>
            {/* Blurred backdrop of the same shot fills empty space when we
                use object-contain, so the card never shows raw background. */}
            {(useContain || (isWebsite && item.placeholderSrc)) && (
              <div
                aria-hidden
                className="absolute inset-0 scale-110 blur-2xl opacity-40"
                style={{
                  backgroundImage: `url(${item.placeholderSrc || imgSrc})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}
            {isWebsite && item.srcMobile && item.src ? (
              <picture className="absolute inset-0 block h-full w-full">
                {/* Phones are pinned to the 420px WebP even on high-DPR screens.
                    This avoids the browser choosing the larger desktop tile just
                    because the display is dense. */}
                <source media="(max-width: 767px)" srcSet={item.srcMobile} />
                <img
                  src={item.src}
                  alt={item.title}
                  width={960}
                  height={540}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  onLoad={() => noteImageLoaded(performance.now() - mountedAt)}
                  className={`h-full w-full ${imgFit} transition-transform duration-500 ${clickable ? "group-hover:scale-105" : ""}`}
                />
              </picture>
            ) : (
              <img
                src={imgSrc}
                alt={item.title}
                width={640}
                height={480}
                loading={isCached ? "eager" : "lazy"}
                fetchPriority={isCached ? "high" : "auto"}
                decoding="async"
                onLoad={() => noteImageLoaded(performance.now() - mountedAt)}
                // While the low-res placeholder is showing we soften it a touch
                // so the upgrade to the sharp shot reads as a refine, not a swap.
                className={`absolute inset-0 h-full w-full ${imgFit} transition-[transform,filter] duration-500 ${isFinal ? "" : "blur-[2px] scale-[1.02]"} ${clickable ? "group-hover:scale-105" : ""}`}
              />
            )}

          </>
        ) : (
          <ComingSoonSurface icon={<ImageIcon className="h-8 w-8" />} label="Image URL slot" />
        )}
        {clickable && (
          <span className="pointer-events-none absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
            <ExternalLink className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display uppercase text-lg truncate">{item.title}</h3>
          <p className="label-mono mt-1">{item.kind}</p>
        </div>
        {isWebsite && clickable ? (
          <span className="label-mono flex items-center gap-1 text-[9px] opacity-70 shrink-0">
            {/* Mobile/tablet path: new tab. Desktop: in-page preview. */}
            <span className="lg:hidden inline-flex items-center gap-1">
              New tab <ExternalLink className="h-3 w-3" aria-hidden />
            </span>
            <span className="hidden lg:inline">Preview ↗</span>
          </span>
        ) : (
          <span className="label-mono text-[9px] opacity-70 shrink-0">
            {clickable ? "Visit ↗" : item.src ? "View" : "Soon"}
          </span>
        )}
      </div>

    </Wrapper>
  );
}

function ComingSoonSurface({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="coming-soon-surface absolute inset-0 grid place-items-center"
      style={{
        backgroundImage:
          "radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--sec-a) 40%, transparent), transparent 60%), radial-gradient(circle at 70% 80%, color-mix(in oklab, var(--sec-c) 35%, transparent), transparent 55%)",
      }}
    >
      <div className="text-center">
        <div className="coming-soon-icon mx-auto grid place-items-center h-14 w-14 rounded-2xl">
          {icon}
        </div>
        <p className="label-mono mt-4">New drop incoming</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}
