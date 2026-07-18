import { createFileRoute } from "@tanstack/react-router";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { CanvasCursor } from "@/components/CanvasCursor";
import { SmoothScroll } from "@/components/SmoothScroll";
import { InteractiveCards } from "@/components/InteractiveCards";
import { DeferredAdblockGate } from "@/components/DeferredAdblockGate";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { Nav } from "@/components/galaxy/Nav";
import { Hero } from "@/components/galaxy/Hero";
import { Services } from "@/components/galaxy/Services";
import { Portfolio } from "@/components/galaxy/Portfolio";
import { Process } from "@/components/galaxy/Process";
import { Pricing } from "@/components/galaxy/Pricing";
import { FAQ } from "@/components/galaxy/FAQ";
import { Contact } from "@/components/galaxy/Contact";
import { Footer } from "@/components/galaxy/Footer";
import { getPublicPricing, getPublicPortfolio, getPublicCategories, type PublicPortfolioItem } from "@/lib/public-data.functions";
import type { PricingPlan } from "@/config/site";
import type { PortfolioCategory } from "@/lib/portfolio-config";

/* ============================================================================
 * NEVER GALAXY, LANDING PAGE (Bento / Multi-Nebula edition)
 * ----------------------------------------------------------------------------
 * Section order (edit by re-ordering the JSX below):
 *   Nav → Hero → Services → Portfolio → Process → Pricing → FAQ → Contact → Footer
 * Each section owns its own palette via a `.sec-*` class. The global backdrop
 * (starfield + gradient) is shared.
 * ========================================================================== */
export const Route = createFileRoute("/")({
  // Loader-fed live data: SSR fetches published plans + portfolio in parallel;
  // on any failure returns null and components fall back to static defaults.
  loader: async () => {
    const [pricing, portfolio, categories] = await Promise.all([
      getPublicPricing(),
      getPublicPortfolio(),
      getPublicCategories(),
    ]);
    return { pricing, portfolio, categories };
  },
  errorComponent: () => <Index />,
  notFoundComponent: () => <Index />,
  head: () => ({
    meta: [
      { title: "Never Galaxy | Premium video, motion & design studio" },
      {
        name: "description",
        content:
          "Never Galaxy is a creative studio for cinematic video editing, motion graphics, and high-converting thumbnails. Custom web design launching soon.",
      },
      { property: "og:title", content: "Never Galaxy | Premium creative studio" },
      {
        property: "og:description",
        content: "Cinematic video, motion graphics, and thumbnails engineered for attention.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://nevergalaxy.vercel.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://nevergalaxy.vercel.app/" }],

    // FAQPage + Service schemas, mirror the on-page FAQ (galaxy/FAQ.tsx)
    // and the offered services (galaxy/Services.tsx) so Google can render
    // FAQ rich results and understand the studio's offerings.
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { q: "How fast do you deliver?", a: "First drafts land within 48 hours for most video and thumbnail work. Larger scope like brand films or motion identities take 1–2 weeks." },
            { q: "Do you really do unlimited revisions?", a: "Yes. We iterate until the piece feels right, no revision-count games, no upsell traps." },
            { q: "Can I hire you for a single project?", a: "Absolutely. Most clients start with one deliverable, then move to a monthly retainer once they see the workflow." },
            { q: "Do you provide raw project files?", a: "Project-package clients receive source files on delivery. Monthly plans keep sources archived with us." },
            { q: "Do you take on custom web design?", a: "Yes, early-access slots are open now. Mention 'custom web' when you get in touch and we'll scope it with you." },
            { q: "How do payments work?", a: "50% to kick off a project, 50% on delivery. Monthly plans bill on the 1st. Bank transfer, card, or crypto." },
          ].map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Creative studio",
          provider: { "@type": "Organization", name: "Never Galaxy" },
          areaServed: "Worldwide",
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Never Galaxy services",
            itemListElement: [
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Cinematic video editing" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Motion graphics" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Thumbnail design" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Custom web design" } },
            ],
          },
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const data = Route.useLoaderData?.() as
    | { pricing: PricingPlan[] | null; portfolio: PublicPortfolioItem[] | null; categories?: PortfolioCategory[] }
    | undefined;
  const livePricing = data?.pricing ?? null;
  const livePortfolio = data?.portfolio ?? null;
  const liveCategories = data?.categories;
  return (
    <CurrencyProvider>
      <SmoothScroll>
        <div className="relative bg-cosmic-gradient">
          <StarfieldBackground />
          <CanvasCursor />
          <InteractiveCards />
          <DeferredAdblockGate />
          <div className="relative z-10">
            <Nav />
            <main>
              <Hero />
              <Services />
              <Portfolio liveItems={livePortfolio ?? undefined} categories={liveCategories} />
              <Process />
              <Pricing plans={livePricing ?? undefined} />
              <FAQ />
              <Contact />
            </main>
            <Footer />
          </div>
        </div>
      </SmoothScroll>
    </CurrencyProvider>
  );
}
