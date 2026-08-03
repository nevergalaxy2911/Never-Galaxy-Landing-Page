import { Quote, BadgeCheck } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import { DEFAULT_TESTIMONIALS, type Testimonial } from "@/lib/testimonials-config";

/* -----------------------------------------------------------------------------
 * TESTIMONIALS, client quotes in a bento masonry grid.
 * HOW TO MODIFY:
 * • Add / edit / reorder a quote → /admin -> Testimonials tab (stored in the
 *   `testimonials.items` site setting and passed in here as `items`).
 * • Offline / fallback copy      → DEFAULT_TESTIMONIALS in
 *   src/lib/testimonials-config.ts, used whenever the database is empty or
 *   unreachable so the section never blanks out.
 * • Social proof chip            → the `proof` field, e.g. "$40 paid".
 *   Leave it empty and the card shows the neutral "Verified client" chip.
 * • Recolor                      → change `sec-nova` on the <section>.
 * • Reorder in the page          → move <Testimonials /> in src/routes/index.tsx.
 * --------------------------------------------------------------------------- */

export function Testimonials({ items }: { items?: Testimonial[] }) {
  const head = useReveal<HTMLDivElement>(0);
  const grid = useReveal<HTMLDivElement>(120);
  const list = (items?.length ? items : DEFAULT_TESTIMONIALS).filter((t) => t.enabled !== false);

  if (!list.length) return null;

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

        <div
          ref={grid}
          className="reveal mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {list.map((t, i) => (

            <figure
              key={t.name}
              className="bento p-7 md:p-8 flex flex-col gap-5"
              // Slight per-tile hue rotation keeps the grid from looking flat.
              style={{ filter: `hue-rotate(${i * 5}deg)` }}
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
                  <span className="block text-xs text-muted-foreground mt-1">
                    {t.role}
                  </span>
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap"
                  style={{
                    background:
                      "color-mix(in oklab, var(--sec-a) 16%, transparent)",
                    border:
                      "1px solid color-mix(in oklab, var(--sec-a) 40%, transparent)",
                    color: "color-mix(in oklab, var(--sec-a) 92%, white)",
                  }}
                >
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.proof ?? "Verified client"}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
