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
import { aspectRatioCss, spanForAspect } from "@/lib/portfolio-aspect";
import { DEFAULT_WEBSITES, visibleWebsites, type WebsiteEntry } from "@/lib/websites-config";
import { PORTFOLIO } from "@/config/site";

import { logPortfolioClick } from "@/lib/portfolio-clicks.functions";
import { warmImageCache, markImageDecoded } from "@/lib/imageCache";
import { screenshotTier } from "@/lib/deviceTier";

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
  "md:col-span-3",
  "md:col-span-3",
  "md:col-span-2",
  "md:col-span-2",
  "md:col-span-2",
];

const WEB_SPAN_CYCLE = [
  "md:col-span-3",
  "md:col-span-3",
  "md:col-span-2",
  "md:col-span-2",
  "md:col-span-2",
];

// Static placeholder tiles per category kind, shown when a category has zero
// live rows so the section never looks empty on a fresh deploy.
const STATIC_VIDEO_FALLBACK: VideoItem[] = [
  { id: "sv1", title: "Featured edit",     kind: "New drop incoming", span: SPAN_CYCLE[0] },
  { id: "sv2", title: "Brand film",        kind: "Coming soon",       span: SPAN_CYCLE[1] },
  { id: "sv3", title: "Short-form reel",   kind: "Coming soon",       span: SPAN_CYCLE[2] },
  { id: "sv4", title: "Long-form cut",     kind: "Coming soon",       span: SPAN_CYCLE[3] },
  { id: "sv5", title: "Launch trailer",    kind: "Coming soon",       span: SPAN_CYCLE[4] },
];
const STATIC_IMAGE_FALLBACK: GraphicItem[] = [
  { id: "sg1", title: "Featured design",  kind: "New drop incoming", span: SPAN_CYCLE[0] },
  { id: "sg2", title: "Poster",           kind: "Coming soon",       span: SPAN_CYCLE[1] },
  { id: "sg3", title: "Cover art",        kind: "Coming soon",       span: SPAN_CYCLE[2] },
  { id: "sg4", title: "Social carousel",  kind: "Coming soon",       span: SPAN_CYCLE[3] },
  { id: "sg5", title: "Brand mark",       kind: "Coming soon",       span: SPAN_CYCLE[4] },
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

// Live shipped websites, showcased under the "Website" tab.
// SOURCE OF TRUTH: /admin -> Websites (site_settings row `portfolio.websites`),
// delivered through the route loader as the `websites` prop. When the database
// has nothing saved we fall back to the shipped static list so the tab is never
// empty. The first `featured` entry (else the first entry) claims the biggest
// bento tile.
type WebsiteTile = GraphicItem & { slug: string; liveUrl: string; srcTablet?: string };

function buildWebsiteTiles(list: WebsiteEntry[]): WebsiteTile[] {
  const sites = visibleWebsites(list);
  
  // Sort: featured items first
  const sortedSites = [...sites].sort((a, b) => {
    const aFeat = a.featured ? 1 : 0;
    const bFeat = b.featured ? 1 : 0;
    return bFeat - aFeat;
  });

  let regularIndex = 0;

  return sortedSites.map((s) => {
    const isFeatured = s.featured;
    
    // Featured gets a full-width hero span (6 cols)
    // Regular items cycle through a 3-3-2-2-2 pattern to fill the 6-col grid
    const span = isFeatured 
      ? "md:col-span-6 md:row-span-3" 
      : WEB_SPAN_CYCLE[regularIndex++ % WEB_SPAN_CYCLE.length];
    
    return {
      id: `web-${s.slug}`,
      slug: s.slug,
      title: s.title,
      kind: s.subtitle,
      src: s.tileSrc,
      srcTablet: s.tileTabletSrc,
      srcMobile: s.tileMobileSrc,
      placeholderSrc: s.blurSrc,
      previewSrc: s.detailDesktopSrc,
      href: s.liveUrl,
      liveUrl: s.liveUrl,
      featured: isFeatured,
      span,
      // Pass the slug down so GraphicTile can handle per-site CSS overrides
      itemSlug: s.slug,
    };
  });
}

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
  previewImageTablet?: string;
  previewImageMobile?: string;
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
  websites,
}: {
  liveItems?: PublicPortfolioItem[];
  categories?: PortfolioCategory[];
  /** Admin-managed website list (loader-fed). Falls back to the static list. */
  websites?: WebsiteEntry[];
}) {
  const cats = useMemo(
    () => (categories?.length ? categories : DEFAULT_CATEGORIES).filter((c) => c.enabled),
    [categories],
  );
  // Built once per list change so tile spans / image URLs stay referentially
  // stable across re-renders (no needless re-decode of the screenshots).
  const websiteTiles = useMemo(
    () => buildWebsiteTiles(websites?.length ? websites : DEFAULT_WEBSITES),
    [websites],
  );
  const [tab, setTab] = useState<string>(() => cats[3]?.id ?? "web");
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
    const srcs = websiteTiles.flatMap((w) =>
      low ? [w.placeholderSrc, w.srcMobile] : [w.placeholderSrc, w.srcMobile, w.srcTablet, w.src, w.previewSrc],
    );
    let cancelIdle: () => void = () => {};
    let alive = true;

    // Cheap DNS warm-up for the live preview origins. Actual connections wait
    // for pointer/focus intent so the home page stays light.
    warmWebsiteOrigins(websiteTiles.map((w) => w.liveUrl), false);

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
  }, [websiteTiles]);

  /* INTENT PREFETCH — warm a tab's imagery the instant the visitor shows they
   * are about to open it. Runs at most once per tab (prefetchedTabs). */
  const prefetchedTabs = useRef<Set<string>>(new Set());
  const prefetchTab = useCallback((id: string) => {
    const category = cats.find((c) => c.id === id);
    if (!isWebsiteCategory(category) || prefetchedTabs.current.has(id)) return;
    prefetchedTabs.current.add(id);
    const low = screenshotTier() === "low";
    const srcs = websiteTiles.flatMap((w) =>
      low ? [w.placeholderSrc, w.srcMobile] : [w.placeholderSrc, w.srcMobile, w.srcTablet, w.src, w.previewSrc],
    );
    warmWebsiteOrigins(websiteTiles.map((w) => w.liveUrl), true);
    void loadWebsitePreviewModal();
    void import("@/lib/imageCache").then(({ warmImageCacheNow }) => warmImageCacheNow(srcs));
  }, [cats, websiteTiles]);

  const head = useReveal<HTMLDivElement>(0);
  const grid = useReveal<HTMLDivElement>(120);

  // Group live items by category id.
  const grouped = useMemo(() => {
    const g: Record<string, PublicPortfolioItem[]> = {};
    if (liveItems) for (const it of liveItems) (g[it.category] ??= []).push(it);
    return g;
  }, [liveItems]);

  if (!activeCat) return null;

  const rows = grouped[activeCat.id] ?? [];
  // Live rows carry a per-item `aspect` chosen in /admin. It decides BOTH the
  // bento span (how much grid the card claims) and the media box shape, so a
  // 9:16 Short gets a tall card and a 16:9 film gets a wide one, with the
  // bento pattern preserved. Rows without a saved shape fall back to the
  // classic cycling span pattern.
  // Filter first, then sort
  const filteredRows = (grouped[activeCat.id] ?? []);
  
  // Dynamically apply sorting to ALL tabs
  // 1. Featured items first
  // 2. Map to display types
  const sortedRows = [...filteredRows].sort((a, b) => {
    const aFeat = a.featured ? 1 : 0;
    const bFeat = b.featured ? 1 : 0;
    return bFeat - aFeat;
  });

  const videos: VideoItem[] = (activeCat.kind === "video")
    ? (sortedRows.length
      ? sortedRows.map((it, i) => ({
          id: it.id,
          title: it.title,
          kind: it.subtitle || activeCat.label,
          youtubeId: it.youtubeId,
          span: it.featured ? "md:col-span-6 md:row-span-3" : (it.aspect ? spanForAspect(it.aspect) : pickSpan(i)),
          aspect: it.aspect,
          featured: it.featured,
        }))
      : STATIC_VIDEO_FALLBACK)
    : [];

  const graphics: GraphicItem[] = (activeCat.kind === "image")
    ? (activeIsWebsite
      ? websiteTiles
      : (sortedRows.length
        ? sortedRows.map((it, i) => ({
            id: it.id,
            title: it.title,
            kind: it.subtitle || activeCat.label,
            src: it.thumbUrl || it.url,
            href: it.url && /^https?:\/\//.test(it.url) ? it.url : undefined,
            span: it.featured ? "md:col-span-6 md:row-span-3" : (it.aspect ? spanForAspect(it.aspect) : pickSpan(i)),
            aspect: it.aspect,
            featured: it.featured,
          }))
        : STATIC_IMAGE_FALLBACK))
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
            <div className="portfolio-tab-list flex flex-nowrap gap-1 overflow-x-auto md:justify-center">
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

        <div ref={grid} className="reveal mt-14 grid grid-cols-1 md:grid-cols-6 auto-rows-[minmax(180px,auto)] gap-6 website-portfolio-grid">
          {activeCat.kind === "video" && videos.map((v) => <VideoTile key={v.id} item={v} />)}
          {activeCat.kind === "image" && graphics.map((g, i) => (
            <GraphicTile
              key={g.id}
              item={g}
              priority={i < 2}
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
            previewImageTablet={preview.previewImageTablet}
            previewImageMobile={preview.previewImageMobile}
          />
        </Suspense>
      )}
    </section>
  );
}

/* ---------- Video tile: YouTube facade ----------
 * The media box uses the admin-chosen aspect ratio (16:9, 9:16, 1:1 or an
 * exact pixel resolution). The browser reserves that exact box before the
 * thumbnail arrives, so the bento never jumps while tiles load.
 * HOW TO MODIFY: /admin -> Portfolio -> Card shape on the item. */
function VideoTile({ item }: { item: VideoItem }) {
  const [playing, setPlaying] = useState(false);
  return (
    /* data-playing tells useInteractiveCards to drop the spotlight + tilt
       while the YouTube embed is on screen. */
    <article data-playing={playing ? "true" : undefined} className={`bento overflow-hidden flex flex-col ${item.span}`}>
      <div
        className="relative flex-1 min-h-[180px] tile-surface"
        style={item.aspect ? { aspectRatio: aspectRatioCss(item.aspect), minHeight: 0 } : undefined}
      >

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
      <div className="p-5 flex items-center justify-between gap-4 portfolio-tile-footer">
        <div className="min-w-0">
          <h3 className="font-display uppercase text-lg truncate leading-none portfolio-tile-text">{item.title}</h3>
          <p className="label-mono mt-1.5 text-[10px] opacity-60 tracking-widest portfolio-tile-text">{item.kind}</p>
        </div>
        <span className="label-mono text-[9px] opacity-40 px-2 py-1 rounded border border-white/5 uppercase shrink-0 portfolio-tile-text">{item.youtubeId ? "Play" : "Soon"}</span>
      </div>
    </article>
  );
}

/* ---------- Graphic tile: image, external link, or website preview ---------- */
function GraphicTile({
  item,
  isWebsite,
  onPreview,
  priority,
}: {
  item: GraphicItem & { srcTablet?: string; itemSlug?: string };
  isWebsite?: boolean;
  onPreview?: (t: PreviewTarget) => void;
  /** Above-the-fold tile: fetched eagerly. Everything else lazy-loads. */
  priority?: boolean;
}) {
  const logClick = useServerFn(logPortfolioClick);
  const clickable = Boolean(item.href);
  const slug = item.id.startsWith("web-") ? item.id.slice(4) : item.id;

  // Websites use `object-cover` and `object-top` for a full-bleed, edge-to-edge
  // layout that shows the hero section recognisably.
  const imgFit = "object-cover";
  const imgPosition = "object-top";

  // Website tiles are tiny WebP files that bypass the localStorage
  // screenshot hook completely to keep switching on the browser's native
  // memory cache path.
  const imgSrc = item.src;
  const isFinal = true;
  const isCached = false;

  // Reference point for the "last rendered" figure in the diagnostics panel.
  const [mountedAt] = useState(() => (typeof performance !== "undefined" ? performance.now() : 0));

  /* SKELETON: until the screenshot has actually painted we show a cheap
   * shimmering placeholder instead of an empty hole. This is what removes the
   * "laggy" feeling on a phone: the grid has structure from frame one.
   * HOW TO MODIFY: the shimmer visuals live in `.tile-skeleton` (portfolio.css). */
  const [loaded, setLoaded] = useState(true);
  const onImgLoad = () => {
    // Already forced to true, but keeping handler for analytics consistency
  };

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
      previewImageTablet: item.srcTablet,
      previewImageMobile: item.srcMobile,
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
      className={`bento group overflow-hidden flex flex-col text-left ${item.span} ${clickable ? "cursor-pointer" : ""} ${item.featured ? "featured-hero" : ""} ${isWebsite ? "website-tile" : ""}`}
      data-site-slug={item.itemSlug}
    >
      <div
        // `data-web-tile` lets portfolio.css give phone screenshots a taller,
        // top-anchored crop so the site is actually recognisable on a phone.
        data-web-tile={isWebsite ? "true" : undefined}
        className="relative flex-1 min-h-[200px] tile-surface overflow-hidden"
        // Admin-chosen shape wins for normal image tiles. Website tiles keep
        // their tuned responsive crop rules from portfolio.css.
        style={!isWebsite && item.aspect ? { aspectRatio: aspectRatioCss(item.aspect), minHeight: 0 } : undefined}
      >

        {item.src ? (
          <>
            {/* Skeleton removed to prevent infinite loading visual bug */}

            {/* Blurred placeholder backdrop: fills the container while the heavy WebP
                is fetching/decoding. This keeps the card visually full and
                removes the empty-box "pop" on slow connections. */}
            {isWebsite && item.placeholderSrc && (
              <div
                aria-hidden
                data-tile-blur
                className="absolute inset-0 blur-2xl opacity-60 transition-opacity duration-700"
                style={{
                  backgroundImage: `url(${item.placeholderSrc})`,
                  backgroundSize: "cover",
                  backgroundPosition: "top center",
                  opacity: 0,
                }}
              />
            )}

            {isWebsite && item.src ? (
              <picture className="absolute inset-0 block h-full w-full">
                {/* Mobile (under 768px): Vertical phone screenshot */}
                <source media="(max-width: 767px)" srcSet={item.srcMobile} />
                {/* Tablet (768px to 1024px): Tablet/iPad mockup */}
                {item.srcTablet && (
                  <source media="(min-width: 768px) and (max-width: 1024px)" srcSet={item.srcTablet} />
                )}
                {/* Desktop/PC (over 1024px): Wide desktop mockup */}
                <img
                  src={item.src}
                  alt={`Screenshot of the ${item.title} ${item.kind} website`}
                  width={1920}
                  height={1080}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  loading={priority ? "eager" : "lazy"}
                  fetchPriority={priority ? "high" : "low"}
                  decoding="async"
                  onLoad={onImgLoad}
                  className={`h-full w-full ${imgFit} ${imgPosition} transition-[transform,opacity] duration-500 opacity-100 ${clickable ? "group-hover:scale-105" : ""}`}
                />
              </picture>
            ) : (
              <img
                src={imgSrc}
                alt={`Portfolio preview: ${item.title}`}
                width={1280}
                height={720}
                loading={isCached || priority ? "eager" : "lazy"}
                fetchPriority={isCached || priority ? "high" : "auto"}
                decoding="async"
                onLoad={onImgLoad}
                // While the low-res placeholder is showing we soften it a touch
                // so the upgrade to the sharp shot reads as a refine, not a swap.
                className={`absolute inset-0 h-full w-full ${imgFit} ${imgPosition} transition-[transform,filter,opacity] duration-500 opacity-100 ${isFinal ? "" : "blur-[2px] scale-[1.02]"} ${clickable ? "group-hover:scale-105" : ""}`}
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
      <div className="p-5 flex items-center justify-between gap-4 portfolio-tile-footer">
        <div className="min-w-0">
          <h3 className="font-display uppercase text-lg truncate leading-none portfolio-tile-text">{item.title}</h3>
          <p className="label-mono mt-1.5 text-[10px] opacity-60 tracking-widest portfolio-tile-text">{item.kind}</p>
        </div>
        {isWebsite && clickable ? (
          <span className="label-mono flex items-center gap-1 text-[9px] opacity-60 shrink-0 portfolio-tile-text">
            <span className="lg:hidden inline-flex items-center gap-1 uppercase tracking-tighter">
              Open ↗
            </span>
            <span className="hidden lg:inline uppercase tracking-tighter">Preview ↗</span>
          </span>
        ) : (
          <span className="label-mono text-[9px] opacity-40 px-2 py-1 rounded border border-white/5 uppercase shrink-0 portfolio-tile-text">
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
