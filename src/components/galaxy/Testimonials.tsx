import { Quote, BadgeCheck } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import { DEFAULT_TESTIMONIALS, type Testimonial } from "@/lib/testimonials-config";

/* -----------------------------------------------------------------------------
 * TESTIMONIALS, client quotes on an infinite two-row marquee.
 *
 * HOW TO MODIFY:
 * • Add / edit / reorder a quote → /admin -> Testimonials tab (stored in the
 *   `testimonials.items` site setting and passed in here as `items`).
 * • Offline / fallback copy      → DEFAULT_TESTIMONIALS in
 *   src/lib/testimonials-config.ts, used whenever the database is empty or
 *   unreachable so the section never blanks out.
 * • Social proof chip            → the `proof` field, e.g. "$40 paid".
 * • Scroll speed / card width    → src/styles/marquee.css (`--marquee-duration`,
 *   `--marquee-card`). Each row sets its own duration inline below.
 * • One row instead of two       → set `rows` to `[list]` in the render below.
 * • Recolor                      → change `sec-nova` on the <section>.
 *
 * WHY A MARQUEE AND NOT A SLIDER: no JS timers, no layout thrash, pauses on
 * hover/focus, and under prefers-reduced-motion it degrades into a plain
 * swipeable row (see marquee.css), so small screens never break.
 * --------------------------------------------------------------------------- */

export function Testimonials({ items }: { items?: Testimonial[] }) {
  const head = useReveal<HTMLDivElement>(0);
  const body = useReveal<HTMLDivElement>(120);
  const list = (items?.length ? items : DEFAULT_TESTIMONIALS).filter((t) => t.enabled !== false);

  if (!list.length) return null;

  // Split into two rows that travel in opposite directions. With a single
  // quote we just use one row so it does not look empty.
  const half = Math.ceil(list.length / 2);
  const rows: Testimonial[][] = list.length > 2 ? [list.slice(0, half), list.slice(half)] : [list];

  return (
    <section id="testimonials" className="sec-nova nebula-wash relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div ref={head} className="reveal max-w-3xl">
          <span className="label-chip">05 · Testimonials</span>
          <h2 className="mt-6 font-display uppercase text-[clamp(2rem,5vw,4rem)]">
            Clients, <span className="text-gradient-nebula">on record</span>.
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            Real feedback from people who hired us, paid, and came back with the
            next brief.
          </p>
        </div>
      </div>

      <div ref={body} className="reveal mt-14 space-y-4">
        {rows.map((row, r) => (
          <Row key={r} row={row} reverse={r % 2 === 1} duration={r % 2 === 1 ? 78 : 64} />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground/70">
        Hover to pause · swipe to browse
      </p>
    </section>
  );
}

/** One infinite ticker row. The list is rendered twice so the loop is seamless. */
function Row({
  row,
  reverse,
  duration,
}: {
  row: Testimonial[];
  reverse: boolean;
  duration: number;
}) {
  // Duplicate the row; the second copy is aria-hidden so screen readers and
  // search engines only ever see each quote once.
  const copies = [false, true];

  return (
    <div className="marquee" style={{ ["--marquee-duration" as string]: `${duration}s` }}>
      <div className={`marquee-track ${reverse ? "marquee-reverse" : ""}`}>
        {copies.map((isClone) =>
          row.map((t, i) => (
            <figure
              key={`${isClone ? "c" : "o"}-${t.name}-${i}`}
              aria-hidden={isClone || undefined}
              /* bento-unclipped: lets the hover glow bleed past the card edge
                 instead of being cut into a hard square by overflow:hidden. */
              className="marquee-item bento bento-unclipped bento-hover-glow p-7 md:p-8 flex flex-col gap-5"
              /* NOTE: no per-card `filter` here on purpose. A filter on every
                 card forces a separate composited layer for all 12+ tiles while
                 the track animates, which is what made this section feel laggy. */
            >
              <Quote
                className="h-6 w-6 shrink-0 opacity-80"
                style={{ color: "color-mix(in oklab, var(--sec-a) 90%, white)" }}
                aria-hidden="true"
              />
              <blockquote className="text-[15px] md:text-base leading-relaxed text-muted-foreground">
                {t.quote}
              </blockquote>
              <figcaption className="mt-auto flex items-center justify-between gap-3 border-t border-white/5 pt-4">
                <span>
                  <span className="block font-display uppercase text-base leading-tight">
                    {t.name}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1">{t.role}</span>
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap"
                  style={{
                    background: "color-mix(in oklab, var(--sec-a) 16%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--sec-a) 40%, transparent)",
                    color: "color-mix(in oklab, var(--sec-a) 92%, white)",
                  }}
                >
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.proof ?? "Verified client"}
                </span>
              </figcaption>
            </figure>
          )),
        )}
      </div>
    </div>
  );
}
