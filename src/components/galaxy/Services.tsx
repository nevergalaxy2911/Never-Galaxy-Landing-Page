import { Film, Wand2, Image as ImageIcon, Globe2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

/* -----------------------------------------------------------------------------
 * SERVICES — bento grid of what we do.
 * HOW TO MODIFY:
 * • Add a service → push a new entry into SERVICES.
 * • Recolor the whole section → change `sec-violet` on <section>.
 * • Change tile size → tweak the `span` class in each SERVICES entry.
 * --------------------------------------------------------------------------- */
type Service = {
  icon: LucideIcon;
  title: string;
  body: string;
  bullets: string[];
  span: string; // Tailwind grid-column / row-span classes for md+
};

const SERVICES: Service[] = [
  {
    icon: Film,
    title: "Cinematic video editing",
    body: "Story-first editing for long-form YouTube, short-form reels, and brand films — pacing, sound design, and colour tuned for retention.",
    bullets: ["Long-form", "Shorts / Reels", "Brand films", "Podcasts"],
    span: "md:col-span-4 md:row-span-2",
  },
  {
    icon: Wand2,
    title: "Motion graphics",
    body: "Kinetic type, product reveals, and explainer animations that make ideas feel expensive.",
    bullets: ["Kinetic type", "Explainers", "Logo stings"],
    span: "md:col-span-2 md:row-span-2",
  },
  {
    icon: ImageIcon,
    title: "Thumbnail design",
    body: "Click-worthy thumbnails built as systems — not one-offs — so your channel reads at a glance.",
    bullets: ["A/B variants", "Series systems", "Face retouch"],
    span: "md:col-span-3",
  },
  {
    icon: Globe2,
    title: "Web design & dev",
    body: "Fully custom websites — engineered like a spacecraft, painted like a nebula. Early-access slots open now.",
    bullets: ["Custom design", "Animation-first", "Early access"],
    span: "md:col-span-3",
  },
];

export function Services() {
  const head = useReveal<HTMLDivElement>(0);
  const grid = useReveal<HTMLDivElement>(120);

  return (
    <section id="services" className="sec-violet nebula-wash relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div ref={head} className="reveal max-w-3xl">
          <span className="label-chip">01 · Services</span>
          <h2 className="mt-6 font-display uppercase text-[clamp(2rem,5vw,4rem)]">
            Craft that makes people <span className="text-gradient-nebula">stop scrolling</span>.
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            Four disciplines, one universe. Mix and match — most clients start with
            one, then bring us the rest.
          </p>
        </div>

        <div
          ref={grid}
          className="reveal mt-14 grid grid-cols-1 md:grid-cols-6 auto-rows-[minmax(180px,auto)] gap-4"
        >
          {SERVICES.map(({ icon: Icon, title, body, bullets, span }) => (
            <article key={title} className={`bento p-6 md:p-8 flex flex-col ${span}`}>
              <div className="flex items-center gap-3">
                <span
                  className="grid place-items-center h-11 w-11 rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, color-mix(in oklab, var(--sec-a) 60%, transparent), color-mix(in oklab, var(--sec-c) 45%, transparent))",
                    boxShadow: "0 0 24px color-mix(in oklab, var(--sec-a) 45%, transparent)",
                  }}
                >
                  <Icon className="h-5 w-5 text-white" />
                </span>
                <h3 className="font-display uppercase text-xl md:text-2xl">{title}</h3>
              </div>
              <p className="mt-4 text-muted-foreground">{body}</p>
              <ul className="mt-auto pt-6 flex flex-wrap gap-2">
                {bullets.map((b) => (
                  <li
                    key={b}
                    className="service-chip text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-muted-foreground"
                  >
                    {b}
                  </li>

                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
