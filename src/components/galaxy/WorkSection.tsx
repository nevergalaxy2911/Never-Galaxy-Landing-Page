/* =============================================================================
 * WORK SECTION — the public portfolio grid (rebuilt).
 * -----------------------------------------------------------------------------
 * WHAT IT DOES
 *   Renders the "Work" bento grid straight from the database rows fed in by the
 *   route loader (getPublicPortfolio). Tabs: ALL / VIDEO / GRAPHICS / WEBSITE.
 *   Motion pieces are stored separately but shown inside the VIDEO tab.
 *
 * HOW A CARD IS SHAPED
 *   Each row carries `aspect` (from the admin "Card ratio" choice). That drives
 *   both the bento span and the media box, so a 9:16 Short gets a tall card and
 *   nothing shifts while images load. Featured rows claim a full-width hero.
 *
 * WHAT OPENS ON CLICK
 *   • video / motion → fullscreen YouTube player (lazy-loaded modal)
 *   • website        → in-page live preview on desktop, new tab on mobile
 *   • graphics       → the asset link in a new tab (when one is set)
 *
 * HOW TO MODIFY
 *   • Tabs / labels        → src/lib/work-categories.ts
 *   • Ratios               → src/lib/portfolio-aspect.ts
 *   • Copy above the grid  → this file, HEADING block below.
 * ========================================================================== */
import { lazy, Suspense, useMemo, useState } from "react";
import { ExternalLink, ImageIcon, Play } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import { aspectRatioCss, spanForAspect } from "@/lib/portfolio-aspect";
import type { PublicPortfolioItem } from "@/lib/public-data.functions";
import { normalizeCategory, tabOf, WORK_TABS, type WorkTab } from "@/lib/work-categories";
import { DEFAULT_WEBSITES, visibleWebsites, type WebsiteEntry } from "@/lib/websites-config";
import { PORTFOLIO } from "@/config/site";

const VideoPlayer = lazy(() => import("./VideoPreviewModal"));
const WebsitePreview = lazy(() => import("./WebsitePreviewModal"));

type Tile = {
  id: string;
  title: string;
  subtitle: string;
  tab: Exclude<WorkTab, "all">;
  span: string;
  ratio?: string;
  image: string;
  href?: string;
  youtubeId?: string;
  badge?: string;
  featured?: boolean;
  /** Website tiles only: slug + extra shots for the preview modal. */
  slug?: string;
  imageTablet?: string;
  imageMobile?: string;
  previewImage?: string;
};

type PreviewTarget = {
  slug: string;
  title: string;
  subtitle?: string;
  url: string;
  detailHref?: string;
  previewImage?: string;
  previewImageTablet?: string;
  previewImageMobile?: string;
  youtubeId?: string;
};

const FALLBACK_SPAN = ["md:col-span-3", "md:col-span-3", "md:col-span-2", "md:col-span-2", "md:col-span-2"];

function itemToTile(it: PublicPortfolioItem, i: number): Tile {
  const category = normalizeCategory(it.category);
  const youtubeId = it.youtubeId;
  return {
    id: it.id,
    title: it.title,
    subtitle: it.subtitle,
    tab: tabOf(category),
    span: it.featured
      ? "md:col-span-6 md:row-span-3"
      : it.aspect
        ? spanForAspect(it.aspect)
        : FALLBACK_SPAN[i % FALLBACK_SPAN.length],
    ratio: it.aspect ? aspectRatioCss(it.aspect) : undefined,
    image: it.thumbUrl,
    href: it.url && /^https?:\/\//.test(it.url) ? it.url : undefined,
    youtubeId,
    badge: it.resolutionTag || undefined,
    featured: it.featured,
    slug: category === "website" ? it.id : undefined,
  };
}

function websiteToTile(s: WebsiteEntry, i: number): Tile {
  return {
    id: `web-${s.slug}`,
    slug: s.slug,
    title: s.title,
    subtitle: s.subtitle,
    tab: "website",
    span: s.featured ? "md:col-span-6 md:row-span-3" : FALLBACK_SPAN[i % FALLBACK_SPAN.length],
    image: s.tileSrc,
    imageTablet: s.tileTabletSrc,
    imageMobile: s.tileMobileSrc,
    previewImage: s.detailDesktopSrc || s.tileSrc,
    href: s.liveUrl,
    featured: s.featured,
  };
}

export function WorkSection({
  items,
  websites,
}: {
  items?: PublicPortfolioItem[];
  websites?: WebsiteEntry[];
}) {
  const [tab, setTab] = useState<WorkTab>("all");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const tiles = useMemo<Tile[]>(() => {
    const fromItems = (items ?? []).map(itemToTile);
    const siteList = visibleWebsites(websites?.length ? websites : DEFAULT_WEBSITES);
    const fromSites = siteList.map(websiteToTile);
    const all = [...fromItems, ...fromSites];
    return all.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  }, [items, websites]);

  const visible = useMemo(() => (tab === "all" ? tiles : tiles.filter((t) => t.tab === tab)), [tiles, tab]);
  const tabsWithContent = useMemo(
    () => WORK_TABS.filter((t) => t.id === "all" || tiles.some((tile) => tile.tab === t.id)),
    [tiles],
  );

  const head = useReveal<HTMLDivElement>(0);
  const grid = useReveal<HTMLDivElement>(120);

  if (!tiles.length) return null;

  const openTile = (t: Tile) => {
    if (t.youtubeId) {
      setPreview({
        slug: t.id,
        title: t.title,
        subtitle: t.subtitle,
        url: `https://www.youtube.com/watch?v=${t.youtubeId}`,
        youtubeId: t.youtubeId,
      });
      return;
    }
    if (t.tab === "website" && t.href) {
      const desktop =
        typeof window !== "undefined" &&
        window.matchMedia(`(min-width: ${PORTFOLIO.previewBreakpointPx}px)`).matches;
      if (!desktop) {
        window.open(t.href, "_blank", "noopener,noreferrer");
        return;
      }
      setPreview({
        slug: t.slug ?? t.id,
        title: t.title,
        subtitle: t.subtitle,
        url: t.href,
        detailHref: t.slug ? `/work/${t.slug}` : undefined,
        previewImage: t.previewImage || t.image,
        previewImageTablet: t.imageTablet,
        previewImageMobile: t.imageMobile,
      });
      return;
    }
    if (t.href) window.open(t.href, "_blank", "noopener,noreferrer");
  };

  return (
    <section id="portfolio" className="sec-plum nebula-wash relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        {/* HEADING */}
        <div ref={head} className="reveal flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <span className="label-chip">02 · Work</span>
            <h2 className="mt-6 font-display uppercase text-[clamp(2rem,5vw,4rem)]">
              A <span className="text-gradient-nebula">portfolio</span> in orbit.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Cinematic edits, motion pieces, graphics, and shipped websites. Tap a tile to watch or explore.
            </p>
          </div>

          <div className="portfolio-tabs w-full self-center overflow-hidden md:w-fit md:max-w-full md:self-end">
            <div className="portfolio-tab-list flex flex-nowrap gap-1 overflow-x-auto md:justify-center">
              {tabsWithContent.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  data-active={tab === t.id}
                  className="portfolio-tab inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-mono uppercase tracking-wider transition-all sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-widest"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* GRID */}
        <div
          ref={grid}
          className="reveal website-portfolio-grid mt-14 grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-6 md:grid-cols-6"
        >
          {visible.map((t, i) => (
            <WorkTile key={t.id} tile={t} priority={i < 2} onOpen={openTile} />
          ))}
        </div>
      </div>

      {preview?.youtubeId && (
        <Suspense fallback={null}>
          <VideoPlayer
            open
            onClose={() => setPreview(null)}
            youtubeId={preview.youtubeId}
            title={preview.title}
            subtitle={preview.subtitle}
            url={preview.url}
          />
        </Suspense>
      )}
      {preview && !preview.youtubeId && (
        <Suspense fallback={null}>
          <WebsitePreview
            open
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

/* ---------- One bento card, shaped by its saved ratio ---------- */
function WorkTile({
  tile,
  priority,
  onOpen,
}: {
  tile: Tile;
  priority?: boolean;
  onOpen: (t: Tile) => void;
}) {
  const clickable = Boolean(tile.youtubeId || tile.href);
  const isWebsite = tile.tab === "website";

  return (
    <article
      className={`bento group flex flex-col overflow-hidden text-left ${tile.span} ${tile.featured ? "featured-hero" : ""} ${isWebsite ? "website-tile" : ""}`}
      data-site-slug={isWebsite ? tile.slug : undefined}
    >
      <div
        data-web-tile={isWebsite ? "true" : undefined}
        className="tile-surface relative min-h-[180px] flex-1 overflow-hidden"
        style={!isWebsite && tile.ratio ? { aspectRatio: tile.ratio, minHeight: 0 } : undefined}
      >
        {tile.image ? (
          isWebsite ? (
            <picture className="absolute inset-0 block h-full w-full">
              {tile.imageMobile && <source media="(max-width: 767px)" srcSet={tile.imageMobile} />}
              {tile.imageTablet && (
                <source media="(min-width: 768px) and (max-width: 1024px)" srcSet={tile.imageTablet} />
              )}
              <img
                src={tile.image}
                alt={`Screenshot of the ${tile.title} website`}
                width={1920}
                height={1080}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />
            </picture>
          ) : (
            <img
              src={tile.image}
              alt={`Preview of ${tile.title}`}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                const el = e.currentTarget;
                if (tile.youtubeId && !el.src.includes("hqdefault")) {
                  el.src = `https://i.ytimg.com/vi/${tile.youtubeId}/hqdefault.jpg`;
                }
              }}
            />
          )
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-white/[0.03] text-white/25">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}

        {clickable && (
          <button
            type="button"
            onClick={() => onOpen(tile)}
            aria-label={
              tile.youtubeId
                ? `Play ${tile.title}`
                : isWebsite
                  ? `${tile.title}: open a preview of the live site`
                  : `${tile.title}: open in a new tab`
            }
            className="absolute inset-0 h-full w-full"
          >
            {tile.youtubeId ? (
              <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/10">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-black shadow-2xl transition-transform group-hover:scale-110">
                  <Play className="h-6 w-6 translate-x-[2px]" fill="currentColor" />
                </span>
              </span>
            ) : (
              <span className="pointer-events-none absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
                <ExternalLink className="h-4 w-4" />
              </span>
            )}
          </button>
        )}

        {tile.badge && (
          <span className="label-mono pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[9px] uppercase tracking-widest text-white/80 backdrop-blur">
            {tile.badge}
          </span>
        )}
      </div>

      <div className="portfolio-tile-footer flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="portfolio-tile-text truncate font-display text-lg uppercase leading-none">{tile.title}</h3>
          {tile.subtitle && (
            <p className="portfolio-tile-text label-mono mt-1.5 text-[10px] tracking-widest opacity-60">{tile.subtitle}</p>
          )}
        </div>
        <span className="portfolio-tile-text label-mono shrink-0 rounded border border-white/5 px-2 py-1 text-[9px] uppercase opacity-40">
          {tile.youtubeId ? "Play ↗" : isWebsite ? "Preview ↗" : tile.href ? "Visit ↗" : "View"}
        </span>
      </div>
    </article>
  );
}
