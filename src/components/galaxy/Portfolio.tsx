import { useState, useMemo } from "react";
import { Play, ImageIcon, Sparkles, Globe, Video, Camera, Palette, Music, Mic, Layers } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import type { VideoItem, GraphicItem } from "@/types/portfolio";
import type { PublicPortfolioItem } from "@/lib/public-data.functions";
import {
  DEFAULT_CATEGORIES,
  type PortfolioCategory,
} from "@/lib/portfolio-config";

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
  { id: "sg1", title: "Featured design lands here", kind: "Add via /admin", span: SPAN_CYCLE[0] },
  { id: "sg2", title: "Poster",                     kind: "Coming soon",    span: SPAN_CYCLE[1] },
  { id: "sg3", title: "Cover art",                  kind: "Coming soon",    span: SPAN_CYCLE[2] },
  { id: "sg4", title: "Social carousel",            kind: "Coming soon",    span: SPAN_CYCLE[3] },
  { id: "sg5", title: "Brand mark",                 kind: "Coming soon",    span: SPAN_CYCLE[4] },
];

function pickSpan(i: number): string {
  return SPAN_CYCLE[i % SPAN_CYCLE.length];
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
  const activeCat = cats.find((c) => c.id === tab) ?? cats[0];

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
        span: pickSpan(i),
      }))
    : activeCat.kind === "image"
      ? STATIC_IMAGE_FALLBACK
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
          {activeCat.kind === "image" && graphics.map((g) => <GraphicTile key={g.id} item={g} />)}
        </div>
      </div>
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

/* ---------- Graphic tile: image or placeholder ---------- */
function GraphicTile({ item }: { item: GraphicItem }) {
  return (
    <article className={`bento overflow-hidden flex flex-col ${item.span}`}>
      <div className="relative flex-1 min-h-[200px] tile-surface">
        {item.src ? (
          <img
            src={item.src}
            alt={item.title}
            width={640}
            height={480}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <ComingSoonSurface icon={<ImageIcon className="h-8 w-8" />} label="Image URL slot" />
        )}
      </div>
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display uppercase text-lg truncate">{item.title}</h3>
          <p className="label-mono mt-1">{item.kind}</p>
        </div>
        <span className="label-mono text-[9px] opacity-70 shrink-0">{item.src ? "View" : "Soon"}</span>
      </div>
    </article>
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
