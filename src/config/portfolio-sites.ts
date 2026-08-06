/* =============================================================================
 * PORTFOLIO WEBSITES, single source of truth for the "Website" showcase.
 * -----------------------------------------------------------------------------
 * Every shipped client site lives here. Both the bento tiles on the home
 * portfolio AND the dedicated /work/<slug> detail pages read from this list.
 *
 * HOW TO EDIT (ELI10):
 *   • Add a new site   → copy an entry, change the fields, save.
 *   • Reorder tiles    → move the entry up/down in the array (first entry
 *                        claims the biggest bento tile).
 *   • Hide a site      → set `enabled: false`.
 *   • Change thumbnail → replace desktopSrc / mobileSrc with a new .asset.json
 *                        pointer (see MODIFICATION_GUIDE, "Portfolio Websites").
 *
 * Fields:
 *   slug          - URL-safe id used at /work/<slug>. Never change once live.
 *   title         - Card title, hero H1 on detail page.
 *   subtitle      - Small kind label under the title.
 *   category      - Free-text category (e.g. "Landing page", "SaaS", "eComm").
 *   liveUrl       - Absolute URL of the deployed site.
 *   desktopSrc    - CDN URL for the 1920x1080 desktop hero shot.
 *   mobileSrc     - CDN URL for the 390x844 mobile hero shot.
 *   tileSrc       - tiny WebP used by homepage Website tiles on larger screens.
 *   tileMobileSrc - tiny WebP used by homepage Website tiles on phones.
 *   blurSrc       - sub-1KB placeholder painted behind the tile immediately.
 *   detailDesktopSrc / detailMobileSrc - optimized WebP case-study shots.
 *   description   - 1-3 sentences shown on the detail page hero.
 *   highlights[]  - Optional bullet list ("Project Highlights") on detail page.
 *   featured      - Optional. If true, tile claims the largest bento span.
 *   enabled       - Defaults true. Set false to hide from tiles + detail page.
 * ========================================================================== */

import aureliaDesktop from "@/assets/portfolio-aurelia.png.asset.json";
import vortexDesktop  from "@/assets/portfolio-vortex.png.asset.json";
import nebulaDesktop  from "@/assets/portfolio-nebula.png.asset.json";
import noctisDesktop  from "@/assets/portfolio-noctis.png.asset.json";
import voltaDesktop   from "@/assets/portfolio-volta.png.asset.json";
import atelierDesktop from "@/assets/portfolio-atelier.png.asset.json";

import aureliaMobile from "@/assets/portfolio-aurelia-mobile.png.asset.json";
import vortexMobile  from "@/assets/portfolio-vortex-mobile.png.asset.json";
import nebulaMobile  from "@/assets/portfolio-nebula-mobile.png.asset.json";
import noctisMobile  from "@/assets/portfolio-noctis-mobile.png.asset.json";
import voltaMobile   from "@/assets/portfolio-volta-mobile.png.asset.json";
import atelierMobile from "@/assets/portfolio-atelier-mobile.png.asset.json";

const NEVER_GALAXY_DESKTOP = "/Icons%20and%20images/portfolio/optimized/never-galaxy-desktop.webp";
const NEVER_GALAXY_MOBILE = "/Icons%20and%20images/portfolio/optimized/never-galaxy-mobile.webp";
const WEB_RESUME_THUMB = "/Icons%20and%20images/portfolio/optimized/web-resume-desktop.webp";

export type PortfolioSite = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  liveUrl: string;
  desktopSrc: string;
  mobileSrc: string;
  tileSrc: string;
  tileMobileSrc: string;
  blurSrc: string;
  detailDesktopSrc: string;
  detailMobileSrc: string;
  description: string;
  highlights?: string[];
  featured?: boolean;
  enabled?: boolean;
};

export const PORTFOLIO_SITES: PortfolioSite[] = [
  {
    slug: "maison-aurelia",
    title: "Maison Aurelia",
    subtitle: "Luxury jewellery house",
    category: "Luxury eCommerce",
    liveUrl: "https://aureliamaison.vercel.app/",
    desktopSrc: aureliaDesktop.url,
    mobileSrc: aureliaMobile.url,
    tileSrc: "/Icons%20and%20images/portfolio/optimized/maison-aurelia-tile.webp",
    tileMobileSrc: "/Icons%20and%20images/portfolio/optimized/maison-aurelia-tile-mobile.webp",
    blurSrc: "/Icons%20and%20images/portfolio/optimized/maison-aurelia-blur.webp",
    detailDesktopSrc: "/Icons%20and%20images/portfolio/optimized/maison-aurelia-desktop.webp",
    detailMobileSrc: "/Icons%20and%20images/portfolio/optimized/maison-aurelia-mobile.webp",
    description:
      "A quiet, editorial storefront for a modern jewellery house. Slow parallax, soft gold typography, and a checkout flow tuned for high-ticket pieces.",
    highlights: [
      "Editorial hero with layered parallax scenes",
      "Product pages tuned for high-ticket conversion",
      "Full mobile-first responsive system",
      "Custom typography pairing (serif display + humanist sans)",
    ],
    featured: true,
  },
  {
    slug: "web-resume",
    title: "Celestial CV",
    subtitle: "Interactive Web Resume",
    category: "Personal Branding",
    liveUrl: "https://webresumeabhishek.vercel.app/",
    desktopSrc: WEB_RESUME_THUMB,
    mobileSrc: "/Icons%20and%20images/portfolio/optimized/web-resume-mobile.webp",
    tileSrc: WEB_RESUME_THUMB,
    tileMobileSrc: WEB_RESUME_THUMB,
    blurSrc: WEB_RESUME_THUMB,
    detailDesktopSrc: "/Icons%20and%20images/portfolio/optimized/web-resume-case-study.webp",
    detailMobileSrc: WEB_RESUME_THUMB,
    description:
      "A professional, interactive web-based resume designed for high-impact personal branding. Features optimized PDF export and local data persistence.",
    highlights: [
      "One-click 'Print as PDF' with iframe bypass fix",
      "Local project data storage via localStorage",
      "Responsive typography and high-contrast layouts",
      "Speed-optimized asset delivery and minimal bundle size",
    ],
  },
  {
    slug: "vortex",
    title: "Vortex",
    subtitle: "Gym / performance brand",
    category: "Fitness landing page",
    liveUrl: "https://vortexweight.vercel.app/",
    desktopSrc: vortexDesktop.url,
    mobileSrc: vortexMobile.url,
    tileSrc: "/Icons%20and%20images/portfolio/optimized/vortex-tile.webp",
    tileMobileSrc: "/Icons%20and%20images/portfolio/optimized/vortex-tile-mobile.webp",
    blurSrc: "/Icons%20and%20images/portfolio/optimized/vortex-blur.webp",
    detailDesktopSrc: "/Icons%20and%20images/portfolio/optimized/vortex-desktop.webp",
    detailMobileSrc: "/Icons%20and%20images/portfolio/optimized/vortex-mobile.webp",
    description:
      "A high-energy landing page for a strength brand. Bold typography, scroll-driven reveals, and a membership CTA that stays sticky on mobile.",
    highlights: [
      "Kinetic scroll-driven storytelling",
      "Sticky mobile CTA for membership sign-ups",
      "Testimonial marquee with real athlete quotes",
    ],
  },
  {
    slug: "nebula",
    title: "Nebula",
    subtitle: "SaaS operations layer",
    category: "SaaS marketing site",
    liveUrl: "https://nebulalm.vercel.app/",
    desktopSrc: nebulaDesktop.url,
    mobileSrc: nebulaMobile.url,
    tileSrc: "/Icons%20and%20images/portfolio/optimized/nebula-tile.webp",
    tileMobileSrc: "/Icons%20and%20images/portfolio/optimized/nebula-tile-mobile.webp",
    blurSrc: "/Icons%20and%20images/portfolio/optimized/nebula-blur.webp",
    detailDesktopSrc: "/Icons%20and%20images/portfolio/optimized/nebula-desktop.webp",
    detailMobileSrc: "/Icons%20and%20images/portfolio/optimized/nebula-mobile.webp",
    description:
      "Product-led SaaS marketing site. Interactive feature cards, animated pricing table, and a docs-ready dark mode.",
    highlights: [
      "Interactive feature cards with live previews",
      "Animated pricing table with monthly/yearly toggle",
      "Docs-ready dark mode baked in",
    ],
  },
  {
    slug: "noctis-paradise",
    title: "Noctis Paradise",
    subtitle: "Fine dining restaurant",
    category: "Hospitality",
    liveUrl: "https://noctissparadise.vercel.app/",
    desktopSrc: noctisDesktop.url,
    mobileSrc: noctisMobile.url,
    tileSrc: "/Icons%20and%20images/portfolio/optimized/noctis-paradise-tile.webp",
    tileMobileSrc: "/Icons%20and%20images/portfolio/optimized/noctis-paradise-tile-mobile.webp",
    blurSrc: "/Icons%20and%20images/portfolio/optimized/noctis-paradise-blur.webp",
    detailDesktopSrc: "/Icons%20and%20images/portfolio/optimized/noctis-paradise-desktop.webp",
    detailMobileSrc: "/Icons%20and%20images/portfolio/optimized/noctis-paradise-mobile.webp",
    description:
      "A cinematic restaurant site with reservation flow, seasonal menu, and a moody, midnight-toned aesthetic that mirrors the venue.",
    highlights: [
      "Reservation flow with date + party-size picker",
      "Seasonal menu with lazy-loaded imagery",
      "Cinematic hero video with poster fallback",
    ],
  },
  {
    slug: "volta-arts",
    title: "Volta Arts",
    subtitle: "Brand identity agency",
    category: "Creative agency",
    liveUrl: "https://voltaarts.vercel.app/",
    desktopSrc: voltaDesktop.url,
    mobileSrc: voltaMobile.url,
    tileSrc: "/Icons%20and%20images/portfolio/optimized/volta-arts-tile.webp",
    tileMobileSrc: "/Icons%20and%20images/portfolio/optimized/volta-arts-tile-mobile.webp",
    blurSrc: "/Icons%20and%20images/portfolio/optimized/volta-arts-blur.webp",
    detailDesktopSrc: "/Icons%20and%20images/portfolio/optimized/volta-arts-desktop.webp",
    detailMobileSrc: "/Icons%20and%20images/portfolio/optimized/volta-arts-mobile.webp",
    description:
      "A statement portfolio for a brand identity studio. Case-study driven, with kinetic type and a curated colour system per project.",
    highlights: [
      "Case-study driven portfolio grid",
      "Kinetic typography and colour-per-project system",
      "Custom cursor + smooth scroll",
    ],
  },
  {
    slug: "maison-atelier",
    title: "Maison Atelier",
    subtitle: "Luxury real estate",
    category: "Real estate",
    liveUrl: "https://ateliermaison.vercel.app/",
    desktopSrc: atelierDesktop.url,
    mobileSrc: atelierMobile.url,
    tileSrc: "/Icons%20and%20images/portfolio/optimized/maison-atelier-tile.webp",
    tileMobileSrc: "/Icons%20and%20images/portfolio/optimized/maison-atelier-tile-mobile.webp",
    blurSrc: "/Icons%20and%20images/portfolio/optimized/maison-atelier-blur.webp",
    detailDesktopSrc: "/Icons%20and%20images/portfolio/optimized/maison-atelier-desktop.webp",
    detailMobileSrc: "/Icons%20and%20images/portfolio/optimized/maison-atelier-mobile.webp",
    description:
      "A gallery-first real estate site. Full-bleed listing pages, warm neutral palette, and enquiry forms that route straight to the agency inbox.",
    highlights: [
      "Full-bleed listing pages with image lightbox",
      "Enquiry form wired to agency inbox",
      "Warm neutral palette with editorial serif display type",
    ],
  },
];

export function getPortfolioSite(slug: string): PortfolioSite | undefined {
  return PORTFOLIO_SITES.find((s) => s.slug === slug && s.enabled !== false);
}

export function listPortfolioSites(): PortfolioSite[] {
  return PORTFOLIO_SITES.filter((s) => s.enabled !== false);
}
