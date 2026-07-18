import { useReveal } from "@/hooks/useReveal";

/* -----------------------------------------------------------------------------
 * PROCESS, 4-step working method in a bento layout.
 * HOW TO MODIFY:
 * • Add / edit a step → adjust the STEPS array.
 * • Recolor → change `sec-magenta` on the <section>.
 * --------------------------------------------------------------------------- */
const STEPS = [
  { n: "01", title: "Brief",     body: "You share the goal, references and raw footage. We reply with scope, timeline, and price, usually within a day." },
  { n: "02", title: "Craft",     body: "We cut, animate, and design. Draft one lands in your inbox within 48 hours on most projects." },
  { n: "03", title: "Refine",    body: "You review with time-coded notes. We iterate, unlimited revisions until it hits." },
  { n: "04", title: "Deliver",   body: "Final masters in every format you need, with source files if you're on a project package." },
];

export function Process() {
  const head = useReveal<HTMLDivElement>(0);
  const grid = useReveal<HTMLDivElement>(120);

  return (
    <section id="process" className="sec-magenta nebula-wash relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div ref={head} className="reveal max-w-3xl">
          <span className="label-chip">03 · Process</span>
          <h2 className="mt-6 font-display uppercase text-[clamp(2rem,5vw,4rem)]">
            Four steps.<br /> Zero <span className="text-gradient-nebula">friction</span>.
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            A simple, transparent workflow, so you always know where the project
            is and what happens next.
          </p>
        </div>

        <div
          ref={grid}
          className="reveal mt-14 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-[minmax(220px,auto)]"
        >
          {STEPS.map((s, i) => (
            <article
              key={s.n}
              // Staggered rhythm: odd tiles nudge down for a zig-zag flow
              className={`bento p-8 md:p-10 flex flex-col justify-between ${i % 2 === 1 ? "md:mt-10" : ""}`}
              style={{
                // Slight per-tile hue rotation for extra depth
                filter: `hue-rotate(${i * 6}deg)`,
              }}
            >
              <span
                className="font-display text-6xl md:text-7xl leading-none"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--sec-a) 85%, white), color-mix(in oklab, var(--sec-c) 70%, white))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {s.n}
              </span>
              <div>
                <h3 className="font-display uppercase text-2xl">{s.title}</h3>
                <p className="mt-3 text-muted-foreground">{s.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
