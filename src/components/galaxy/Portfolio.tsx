import { useState, useMemo } from "react";
import { Play, ImageIcon, Sparkles } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import type { VideoItem, GraphicItem } from "@/types/portfolio";
import type { PublicPortfolioItem } from "@/lib/public-data.functions";

/* -----------------------------------------------------------------------------
 * PORTFOLIO — bento gallery split into tabs (Video / Motion / Graphics).
 *
 * DATA SOURCE (priority):
 *   1. `liveItems` prop — fed by the route loader from Supabase
 *      `portfolio_items` via getPublicPortfolio(). Rows are grouped by
 *      `category` ("video" | "motion" | "graphic") and mapped into the
 *      tile shape below. Spans cycle through a preset pattern so grids
 *      always fill cleanly regardless of how many rows exist.
 *   2. Static fallbacks (VIDEO_WORK / MOTION_WORK / GRAPHIC_WORK) when the
 *      DB is empty for that category. Edit those arrays to change defaults.
 *
 * HOW TO ADD WORK (LIVE, no code):
 *   • /admin → Portfolio → add row with category video|motion|graphic,
 *     title, url (YouTube URL for videos; image URL for graphics),
 *     thumb_url (optional graphic image), published=true. Save.
 * --------------------------------------------------------------------------- */

type Tab = "video" | "motion" | "graphic";

const VIDEO_SPANS = [
  "md:col-span-4 md:row-span-2",
  "md:col-span-2",
  "md:col-span-2",
  "md:col-span-3",
  "md:col-span-3",
];
const MOTION_SPANS = [
  "md:col-span-3 md:row-span-2",
  "md:col-span-3",
  "md:col-span-3",
  "md:col-span-3",
];
const GRAPHIC_SPANS = [
  "md:col-span-4 md:row-span-2",
  "md:col-span-2",
  "md:col-span-2",
  "md:col-span-3",
  "md:col-span-3",
];

const VIDEO_WORK: VideoItem[] = [
  { id: "v1", title: "Long-form YouTube edit",  kind: "Long-form · YouTube", span: VIDEO_SPANS[0] },
  { id: "v2", title: "Brand film — 60s",         kind: "Brand · 60s",         span: VIDEO_SPANS[1] },
  { id: "v3", title: "Short-form reel",          kind: "Short-form · 45s",    span: VIDEO_SPANS[2] },
  { id: "v4", title: "Podcast highlight cut",    kind: "Podcast · 8m",        span: VIDEO_SPANS[3] },
  { id: "v5", title: "Product launch film",      kind: "Launch · 90s",        span: VIDEO_SPANS[4] },
];

const MOTION_WORK: VideoItem[] = [
  { id: "m1", title: "Kinetic type sequence",    kind: "Motion · 20s",  span: MOTION_SPANS[0] },
  { id: "m2", title: "Logo sting",               kind: "Motion · 6s",   span: MOTION_SPANS[1] },
  { id: "m3", title: "Animated explainer",       kind: "Motion · 45s",  span: MOTION_SPANS[2] },
  { id: "m4", title: "UI reveal animation",      kind: "Motion · 12s",  span: MOTION_SPANS[3] },
];

const GRAPHIC_WORK: GraphicItem[] = [
  { id: "g1", title: "YouTube thumbnail set",    kind: "YouTube · Series",   span: GRAPHIC_SPANS[0] },
  { id: "g2", title: "Print poster",             kind: "Print · A2",         span: GRAPHIC_SPANS[1] },
  { id: "g3", title: "Podcast cover art",        kind: "Podcast cover",      span: GRAPHIC_SPANS[2] },
  { id: "g4", title: "Social carousel pack",     kind: "IG · Carousel",      span: GRAPHIC_SPANS[3] },
  { id: "g5", title: "Brand mark",               kind: "Identity",           span: GRAPHIC_SPANS[4] },
];

const TABS: { id: Tab; label: string; icon: typeof Play }[] = [
  { id: "video",   label: "Video",           icon: Play },
  { id: "motion",  label: "Motion",          icon: Sparkles },
  { id: "graphic", label: "Graphics",        icon: ImageIcon },
];

function pickSpan(cycle: string[], i: number): string {
  return cycle[i % cycle.length];
}

export function Portfolio({ liveItems }: { liveItems?: PublicPortfolioItem[] }) {
  const [tab, setTab] = useState<Tab>("video");
  const head = useReveal<HTMLDivElement>(0);
  const grid = useReveal<HTMLDivElement>(120);

  // Map DB rows → tile shapes. Fall back to static arrays per category.
  const { videos, motions, graphics } = useMemo(() => {
    if (!liveItems || liveItems.length === 0) {
      return { videos: VIDEO_WORK, motions: MOTION_WORK, graphics: GRAPHIC_WORK };
    }
    const grouped: Record<string, PublicPortfolioItem[]> = { video: [], motion: [], graphic: [] };
    for (const it of liveItems) {
      if (grouped[it.category]) grouped[it.category].push(it);
    }
    const videos: VideoItem[] = grouped.video.length
      ? grouped.video.map((it, i) => ({
          id: it.id,
          title: it.title,
          kind: it.subtitle || "Video",
          youtubeId: it.youtubeId,
          span: pickSpan(VIDEO_SPANS, i),
        }))
      : VIDEO_WORK;
    const motions: VideoItem[] = grouped.motion.length
      ? grouped.motion.map((it, i) => ({
          id: it.id,
          title: it.title,
          kind: it.subtitle || "Motion",
          youtubeId: it.youtubeId,
          span: pickSpan(MOTION_SPANS, i),
        }))
      : MOTION_WORK;
    const graphics: GraphicItem[] = grouped.graphic.length
      ? grouped.graphic.map((it, i) => ({
          id: it.id,
          title: it.title,
          kind: it.subtitle || "Graphic",
          src: it.thumbUrl || it.url,
          span: pickSpan(GRAPHIC_SPANS, i),
        }))
      : GRAPHIC_WORK;
    return { videos, motions, graphics };
  }, [liveItems]);



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
              A rotating showcase of the work we ship — video edits, motion
              pieces, and graphics. Hover a tile, hit play.
            </p>
          </div>

          {/* Tab switcher — high contrast in both themes via portfolio-tab classes (see styles.css).
              Mobile: `flex w-fit mx-auto` centers the pill row (mx-auto only works
              on block/flex, not inline-flex). Buttons shrink to compact size so all
              three fit comfortably on narrow phones without wrapping. */}
          <div className="portfolio-tabs mx-auto flex w-fit justify-center gap-1 self-center rounded-full p-1 md:mx-0 md:self-end">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                data-active={tab === id}
                className="portfolio-tab inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-mono uppercase tracking-wider transition-all sm:gap-2 sm:px-4 sm:py-2 sm:text-xs sm:tracking-widest"
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>

            ))}
          </div>

        </div>

        <div ref={grid} className="reveal mt-14 grid grid-cols-1 md:grid-cols-6 auto-rows-[minmax(200px,auto)] gap-4">
          {tab === "video" && videos.map((v) => <VideoTile key={v.id} item={v} />)}
          {tab === "motion" && motions.map((v) => <VideoTile key={v.id} item={v} />)}
          {tab === "graphic" && graphics.map((g) => <GraphicTile key={g.id} item={g} />)}
        </div>
      </div>
    </section>
  );
}

/* ---------- Video tile: click-to-play YouTube facade, else placeholder ----------
 * Why a facade: a raw YouTube <iframe> pulls ~1.3 MB of JS + spawns ~40
 * subrequests per embed, tanking LCP and blocking the main thread. We render
 * a static thumbnail + play button first, and only swap in the real iframe
 * once the user clicks. Same UX, zero third-party JS until intent.
 * HOW TO TUNE:
 *   • Thumbnail quality: change `hqdefault` → `maxresdefault` for 1280×720
 *     (some videos don't have it — hqdefault always exists).
 *   • Autoplay on click: `?autoplay=1` is already appended, remove if unwanted.
 * -------------------------------------------------------------------------- */
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
          <ComingSoonSurface icon={<Play className="h-8 w-8" />} label="YouTube embed slot" />
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

/* ---------- Graphic tile: image if provided, else placeholder ---------- */
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
          <ComingSoonSurface icon={<ImageIcon className="h-8 w-8" />} label="Image slot" />
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

/* ---------- Shared "Coming Soon" placeholder surface ---------- */
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
