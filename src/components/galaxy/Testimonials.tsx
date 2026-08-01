import { Quote, BadgeCheck } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

/* -----------------------------------------------------------------------------
 * TESTIMONIALS, client quotes in a bento masonry grid.
 * HOW TO MODIFY:
 * • Add / edit a quote  → adjust the TESTIMONIALS array below.
 * • Social proof chip   → set `proof` on an entry (e.g. "$40 paid").
 *   Leave `proof` out and the card shows the neutral "Verified client" chip.
 * • Recolor             → change `sec-nova` on the <section>.
 * • Reorder in the page → move <Testimonials /> inside src/routes/index.tsx.
 * --------------------------------------------------------------------------- */
type Testimonial = {
  name: string;
  role: string;
  /** Optional social-proof chip, e.g. a paid amount. */
  proof?: string;
  quote: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Daniel Brown",
    role: "Project client",
    proof: "$40 paid",
    quote:
      "I recently had the chance to work with Never Galaxy for a project, and I found their service to be quite good. The team was responsive and really listened to my ideas, which made the collaboration smooth. They offered a variety of editing styles to choose from, which helped bring my vision to life. The final product exceeded my expectations, and I appreciated their attention to detail. They were professional and met the deadline. Overall, I would recommend Never Galaxy to anyone looking for reliable video editing services.",
  },
  {
    name: "Thomas Phillips",
    role: "Project client",
    proof: "$180 paid",
    quote:
      "They were very attentive to my needs and took the time to understand the vision I had for my video. The team was responsive and kept me updated throughout the editing process, which I really appreciated. The final product exceeded my expectations; the editing was polished and professional. They incorporated the feedback I provided along the way, ensuring the video truly reflected my ideas.",
  },
  {
    name: "Samuel Torres",
    role: "Creator",
    proof: "$120 paid",
    quote:
      "They have a quirky approach to video editing that adds a fun twist to the end result. It's like they sprinkle a bit of magic dust on your footage, making even the most mundane moments feel entertaining. The team was friendly and super responsive to my requests. If you're looking for something unique and playful, they might just be the agency for you.",
  },
  {
    name: "Matthew",
    role: "Project client",
    proof: "$95 paid",
    quote:
      "Their team was friendly and attentive, making the editing process smooth and enjoyable. I appreciated how they listened to my ideas and turned them into something truly special.",
  },
  {
    name: "James Ramirez",
    role: "Project client",
    proof: "$150 paid",
    quote:
      "I was quite pleased with the results. They were friendly, listened to my ideas, and made the whole process smooth. Overall, I'd recommend them if you need reliable video editing support.",
  },
  {
    name: "Jack Wood",
    role: "Project client",
    proof: "$80 paid",
    quote:
      "Good turnaround time and responsive to my feedback. A solid service, and the kind of communication that makes a remote edit easy to run.",
  },
];

export function Testimonials() {
  const head = useReveal<HTMLDivElement>(0);
  const grid = useReveal<HTMLDivElement>(120);

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
          {TESTIMONIALS.map((t, i) => (
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
