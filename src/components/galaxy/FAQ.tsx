import { useState } from "react";
import { Plus } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

/* -----------------------------------------------------------------------------
 * FAQ — accordion in a bento container.
 * HOW TO MODIFY:
 * • Add / edit a question → adjust FAQS array.
 * • Recolor → change `sec-aurora` on the <section>.
 * --------------------------------------------------------------------------- */
const FAQS = [
  { q: "How fast do you deliver?", a: "First drafts land within 48 hours for most video and thumbnail work. Larger scope like brand films or motion identities take 1–2 weeks." },
  { q: "Do you really do unlimited revisions?", a: "Yes. We iterate until the piece feels right — no revision-count games, no upsell traps." },
  { q: "Can I hire you for a single project?", a: "Absolutely. Most clients start with one deliverable, then move to a monthly retainer once they see the workflow." },
  { q: "Do you provide raw project files?", a: "Project-package clients receive source files on delivery. Monthly plans keep sources archived with us." },
  { q: "Do you take on custom web design?", a: "Yes — early-access slots are open now. Mention 'custom web' when you get in touch and we'll scope it with you." },
  { q: "How do payments work?", a: "50% to kick off a project, 50% on delivery. Monthly plans bill on the 1st. Bank transfer, card, or crypto." },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const head = useReveal<HTMLDivElement>(0);
  const list = useReveal<HTMLDivElement>(120);

  return (
    <section id="faq" className="sec-aurora nebula-wash relative py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div ref={head} className="reveal text-center max-w-2xl mx-auto">
          <span className="label-chip">05 · FAQ</span>
          <h2 className="mt-6 font-display uppercase text-[clamp(2rem,5vw,4rem)]">
            Answers, <span className="text-gradient-nebula">first</span>.
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            The questions we get most often. Don't see yours? Send it via the
            contact form below.
          </p>
        </div>

        <div ref={list} className="reveal mt-14 bento p-4 md:p-6 space-y-2">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b border-white/5 last:border-b-0">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-4 md:py-5 px-2 text-left transition-colors hover:text-white"
                  aria-expanded={isOpen}
                >
                  <span className="font-display uppercase text-[15px] md:text-lg leading-snug">{f.q}</span>
                  <Plus
                    className={`h-5 w-5 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                    style={{ color: "color-mix(in oklab, var(--sec-a) 90%, white)" }}
                  />
                </button>
                {/* faq-panel class is a hook for mobile CSS to disable the
                 * grid-template-rows transition, which is expensive on cheap
                 * phones. Desktop keeps the smooth expand. */}
                <div
                  className="faq-panel grid transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 px-2 text-[14px] md:text-base text-muted-foreground">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
