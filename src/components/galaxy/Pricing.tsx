import { Check } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import { useCurrency } from "@/hooks/useCurrency";
import { PRICING } from "@/config/site";

/* -----------------------------------------------------------------------------
 * PRICING — three sample plans in bento tiles.
 * HOW TO MODIFY:
 * • Plan data (name, price, features, highlighted flag) lives in
 *   `src/config/site.ts` under the `PRICING` export. Edit there, not here.
 * • Prices are authored in INR (base currency). The header CurrencySwitcher
 *   converts them live via useCurrency().format(inr).
 * • Recolor → change `sec-nova` on the <section> below.
 * --------------------------------------------------------------------------- */
const PLANS = PRICING;

export function Pricing() {
  const head = useReveal<HTMLDivElement>(0);
  const grid = useReveal<HTMLDivElement>(120);
  const { format } = useCurrency();


  return (
    <section id="pricing" className="sec-nova nebula-wash relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div ref={head} className="reveal max-w-3xl">
          <span className="label-chip">04 · Pricing</span>
          <h2 className="mt-6 font-display uppercase text-[clamp(2rem,5vw,4rem)]">
            Simple <span className="text-gradient-nebula">rate card</span>.
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            Transparent starting rates. Every quote is tailored to your scope
            — no surprise line items, no hidden add-ons.
          </p>
        </div>

        <div
          ref={grid}
          className="reveal mt-14 grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(420px,auto)]"
        >
          {PLANS.map((p) => (
            <article
              key={p.name}
              className={`bento p-8 flex flex-col relative ${p.highlighted ? "md:scale-[1.03]" : ""}`}
              style={
                p.highlighted
                  ? {
                      boxShadow:
                        "inset 0 1px 0 color-mix(in oklab, white 15%, transparent), 0 40px 100px -30px color-mix(in oklab, var(--sec-a) 90%, transparent), 0 0 90px color-mix(in oklab, var(--sec-c) 55%, transparent)",
                    }
                  : undefined
              }
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 label-chip whitespace-nowrap">
                  Most popular
                </span>
              )}
              <h3 className="font-display uppercase text-2xl">{p.name}</h3>
              <div className="mt-4">
                <div className="font-display text-4xl md:text-5xl text-gradient-nebula">
                  {p.priceInr == null
                    ? p.customPrice
                    : `${p.pricePrefix ?? ""}${format(p.priceInr)}`}
                </div>
                <div className="label-mono mt-1">{p.cadence}</div>
              </div>
              <p className="mt-5 text-muted-foreground">{p.body}</p>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "color-mix(in oklab, var(--sec-a) 90%, white)" }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 font-display text-sm uppercase tracking-widest ${
                  p.highlighted ? "btn-glow" : "btn-ghost-glow"
                }`}
              >
                Start with {p.name.split(" ")[0]}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
