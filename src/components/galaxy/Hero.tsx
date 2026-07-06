import { ArrowRight, Sparkles } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

/* -----------------------------------------------------------------------------
 * HERO — bento-grid hero using a cyan/blue nebula palette.
 * HOW TO MODIFY:
 * • Change the headline words → edit the `<h1>` below.
 * • Swap the palette → change `sec-indigo` on the <section> to `sec-violet`, etc.
 * • Add/remove hero tiles → duplicate a <div className="bento ..."> block.
 * --------------------------------------------------------------------------- */
export function Hero() {
  const kicker = useReveal<HTMLDivElement>(0);
  const title = useReveal<HTMLHeadingElement>(120);
  const sub = useReveal<HTMLParagraphElement>(260);
  const cta = useReveal<HTMLDivElement>(360);
  const grid = useReveal<HTMLDivElement>(200);

  return (
    <section id="top" className="sec-indigo nebula-wash relative pt-32 pb-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Kicker */}
        <div ref={kicker} className="reveal flex justify-center mb-8">
          <span className="label-chip">
            <Sparkles className="h-3 w-3" /> Never Galaxy · Creative Studio
          </span>
        </div>

        {/* Headline */}
        <h1
          ref={title}
          className="reveal text-center font-display uppercase text-[clamp(2.35rem,10.5vw,7.5rem)] leading-[1.02]"
        >
          <span className="sr-only">Never Galaxy — premium video, motion &amp; design studio. </span>
          Content that <span className="text-gradient-nebula">bends</span>
          <br />
          the <span className="text-gradient-nebula">algorithm</span>.
        </h1>

        <p
          ref={sub}
          className="reveal mx-auto mt-8 max-w-2xl text-center text-lg md:text-xl text-muted-foreground"
        >
          Cinematic video editing, motion graphics, and high-converting
          thumbnails for creators, brands, and businesses that refuse to look
          like everyone else.
        </p>

        <div ref={cta} className="reveal mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#contact"
            className="btn-glow inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-display text-sm uppercase tracking-widest"
          >
            Start a project <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#portfolio"
            className="btn-ghost-glow inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-display text-sm uppercase tracking-widest"
          >
            See the work
          </a>
        </div>

        {/* Bento hero grid — 3 tiles, responsive collapse to single col on mobile */}
        <div
          ref={grid}
          className="reveal mt-20 grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(140px,auto)]"
        >
          <HeroTile
            className="md:col-span-4 md:row-span-2 min-h-[280px]"
            label="What we do"
            title="Video · Motion · Thumbnails"
            body="Story-first editing, cinematic motion graphics, and click-worthy thumbnail systems — all engineered to keep eyes on the screen."
          />
          <HeroTile
            className="md:col-span-2 min-h-[140px]"
            label="Turnaround"
            title="48h delivery"
            body="First cut in your inbox within 48 hours on most projects."
          />
          <HeroTile
            className="md:col-span-2 min-h-[140px]"
            label="Revisions"
            title="Unlimited"
            body="We iterate until the piece feels right. No revision-count games."
          />
          <HeroTile
            className="md:col-span-3 min-h-[160px]"
            label="Now booking"
            title="Custom web design & dev"
            body="Fully bespoke websites — engineered like a spacecraft, painted like a nebula."
          />
          <HeroTile
            className="md:col-span-3 min-h-[160px]"
            label="Built for"
            title="Creators · Brands · Businesses"
            body="From solo YouTubers to product launches — we scale the craft to the format."
          />
        </div>
      </div>
    </section>
  );
}

/* Small internal tile component — keeps the JSX above readable. */
function HeroTile({
  className = "",
  label,
  title,
  body,
}: {
  className?: string;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className={`bento p-6 md:p-7 flex flex-col justify-between ${className}`}>
      <span className="label-mono">{label}</span>
      <div className="mt-4">
        <h2 className="font-display uppercase text-2xl md:text-3xl leading-tight">
          {title}
        </h2>
        <p className="mt-3 text-sm md:text-base text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
