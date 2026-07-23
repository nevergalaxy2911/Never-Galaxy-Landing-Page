/**
 * /work/<slug>, dedicated detail page for each portfolio website.
 *
 * Data source: src/config/portfolio-sites.ts. To edit copy, hero images,
 * or highlights for a case study, open that file, not this component.
 */
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ExternalLink, ArrowLeft, Check } from "lucide-react";
import { getPortfolioSite, PORTFOLIO_SITES } from "@/config/portfolio-sites";
import { BRAND } from "@/config/site";

export const Route = createFileRoute("/work/$slug")({
  loader: ({ params }) => {
    const site = getPortfolioSite(params.slug);
    if (!site) throw notFound();
    return { site };
  },
  head: ({ loaderData }) => {
    const s = loaderData?.site;
    if (!s) return {};
    const title = `${s.title} — Case study · ${BRAND.name}`;
    const desc = s.description;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:image", content: s.desktopSrc },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: s.desktopSrc },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center text-white/80">
      <div>
        <h1 className="font-display uppercase text-3xl">Case study not found</h1>
        <p className="mt-3 text-white/60">The site you're looking for isn't in our portfolio.</p>
        <Link
          to="/"
          hash="portfolio"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-widest hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to portfolio
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen grid place-items-center p-6 text-center text-red-200">
      <div>
        <h1 className="font-display uppercase text-2xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-white/60">{(error as Error).message}</p>
        <button onClick={reset} className="mt-4 rounded-full border border-white/20 px-4 py-2 text-xs">
          Try again
        </button>
      </div>
    </div>
  ),
  component: CaseStudyPage,
});

function CaseStudyPage() {
  const { site } = Route.useLoaderData();
  return (
    <main className="relative min-h-screen bg-[#0b0510] text-white">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        {/* Back link */}
        <Link
          to="/"
          hash="portfolio"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/60 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to portfolio
        </Link>

        {/* Hero */}
        <header className="mt-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="label-chip">{site.category}</span>
            <h1 className="mt-4 font-display uppercase text-[clamp(2.25rem,6vw,4.5rem)] leading-[1.02]">
              {site.title}
            </h1>
            <p className="mt-2 text-white/60">{site.subtitle}</p>
          </div>
          <a
            href={site.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-xs uppercase tracking-widest text-black transition hover:bg-white/90"
          >
            <ExternalLink className="h-4 w-4" /> Visit live site
          </a>
        </header>

        {/* Description */}
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/80">{site.description}</p>

        {/* Desktop hero shot */}
        <figure className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-2xl">
          <img
            src={site.desktopSrc}
            alt={`${site.title} desktop hero`}
            width={1920}
            height={1080}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="block h-auto w-full"
          />
        </figure>

        {/* Highlights + mobile */}
        <section className="mt-16 grid gap-10 md:grid-cols-[1fr_320px]">
          {site.highlights && site.highlights.length > 0 && (
            <div>
              <h2 className="font-display uppercase text-2xl">Project highlights</h2>
              <ul className="mt-6 space-y-3">
                {site.highlights.map((h: string) => (
                  <li key={h} className="flex items-start gap-3 text-white/80">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <figure className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl">
            <img
              src={site.mobileSrc}
              alt={`${site.title} mobile hero`}
              width={390}
              height={844}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
            <figcaption className="border-t border-white/10 py-2 text-center text-[10px] uppercase tracking-widest text-white/40">
              Mobile view
            </figcaption>
          </figure>
        </section>

        {/* Bottom nav */}
        <nav className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs uppercase tracking-widest text-white/60">
          <Link to="/" hash="portfolio" className="hover:text-white">
            ← All work
          </Link>
          <div className="flex flex-wrap gap-2">
            {PORTFOLIO_SITES.filter((s) => s.slug !== site.slug && s.enabled !== false)
              .slice(0, 3)
              .map((s) => (
                <Link
                  key={s.slug}
                  to="/work/$slug"
                  params={{ slug: s.slug }}
                  className="rounded-full border border-white/15 px-3 py-1.5 hover:bg-white/10"
                >
                  {s.title}
                </Link>
              ))}
          </div>
        </nav>
      </div>
    </main>
  );
}
