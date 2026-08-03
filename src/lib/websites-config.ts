/* =============================================================================
 * WEBSITES CONFIG, admin-editable list of shipped client websites.
 * -----------------------------------------------------------------------------
 * The "Website" filter on the home portfolio AND every /work/<slug> case study
 * read from here. The list is stored in ONE existing `site_settings` row:
 *     key   = "portfolio.websites"
 *     value = WebsiteEntry[]
 * No new table, no migration. When the row is missing or unreadable the site
 * falls back to DEFAULT_WEBSITES (the static list in
 * `src/config/portfolio-sites.ts`) so the section never blanks out.
 *
 * HOW TO EDIT: /admin -> Websites tab. Add a row, paste the live URL and the
 * image URLs, save. Set "Visible" off to hide a site without deleting it.
 *
 * FIELDS
 *   slug             url id used at /work/<slug>. Auto-derived from the title
 *                    when left empty. Never change it once a link is shared.
 *   title            card title + case-study H1
 *   subtitle         small kind label under the title
 *   category         free text, e.g. "Luxury eCommerce"
 *   liveUrl          absolute https URL of the deployed site
 *   tileSrc          image used by the homepage tile (desktop)
 *   tileMobileSrc    smaller image for phones. Empty = reuse tileSrc
 *   blurSrc          tiny placeholder painted instantly. Empty = reuse tileSrc
 *   detailDesktopSrc big shot on the case-study page + preview modal
 *   detailMobileSrc  phone-shaped shot on the case-study page
 *   description      1-3 sentences on the case-study hero
 *   highlights       optional bullet list on the case-study page
 *   featured         true = claims the biggest bento tile (first one wins)
 *   enabled          false hides it everywhere
 * ========================================================================== */

import { PORTFOLIO_SITES } from "@/config/portfolio-sites";

export type WebsiteEntry = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  liveUrl: string;
  tileSrc: string;
  tileMobileSrc: string;
  blurSrc: string;
  detailDesktopSrc: string;
  detailMobileSrc: string;
  description: string;
  highlights: string[];
  featured: boolean;
  enabled: boolean;
};

/** The shipped list, used whenever the database has nothing saved yet. */
export const DEFAULT_WEBSITES: WebsiteEntry[] = PORTFOLIO_SITES.map((s) => ({
  slug: s.slug,
  title: s.title,
  subtitle: s.subtitle,
  category: s.category,
  liveUrl: s.liveUrl,
  tileSrc: s.tileSrc,
  tileMobileSrc: s.tileMobileSrc,
  blurSrc: s.blurSrc,
  detailDesktopSrc: s.detailDesktopSrc || s.desktopSrc,
  detailMobileSrc: s.detailMobileSrc || s.mobileSrc,
  description: s.description,
  highlights: s.highlights ?? [],
  featured: !!s.featured,
  enabled: s.enabled !== false,
}));

const MAX_WEBSITES = 60;

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Lower-case, dash-separated, url-safe id. */
export function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Coerce ANY stored/posted value into a safe WebsiteEntry[]. Bad rows are
 * dropped rather than crashing a page: a website with no title and no URL is
 * meaningless, everything else has a sensible fallback.
 */
export function sanitizeWebsites(value: unknown): WebsiteEntry[] {
  if (!Array.isArray(value)) return DEFAULT_WEBSITES;
  const seen = new Set<string>();
  const out: WebsiteEntry[] = [];
  for (const raw of value.slice(0, MAX_WEBSITES)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const title = str(r.title, 120);
    const liveUrl = str(r.liveUrl, 500);
    if (!title && !liveUrl) continue;
    let slug = slugify(str(r.slug, 60) || title || liveUrl);
    if (!slug) continue;
    // Keep slugs unique so /work/<slug> can never be ambiguous.
    let n = 2;
    while (seen.has(slug)) slug = `${slugify(str(r.slug, 60) || title)}-${n++}`;
    seen.add(slug);

    const tileSrc = str(r.tileSrc, 500);
    const detailDesktopSrc = str(r.detailDesktopSrc, 500) || tileSrc;
    out.push({
      slug,
      title: title || slug,
      subtitle: str(r.subtitle, 140),
      category: str(r.category, 80),
      liveUrl,
      tileSrc,
      tileMobileSrc: str(r.tileMobileSrc, 500) || tileSrc,
      blurSrc: str(r.blurSrc, 500) || tileSrc,
      detailDesktopSrc,
      detailMobileSrc: str(r.detailMobileSrc, 500) || detailDesktopSrc,
      description: str(r.description, 1000),
      highlights: Array.isArray(r.highlights)
        ? r.highlights.map((h) => str(h, 200)).filter(Boolean).slice(0, 12)
        : [],
      featured: !!r.featured,
      enabled: r.enabled !== false,
    });
  }
  return out;
}

/** Only the sites that should be visible on the public site. */
export function visibleWebsites(list: WebsiteEntry[]): WebsiteEntry[] {
  return list.filter((w) => w.enabled && (w.liveUrl || w.tileSrc));
}

/** A blank row for the admin "Add website" button. */
export function emptyWebsite(): WebsiteEntry {
  return {
    slug: "",
    title: "New website",
    subtitle: "Client build",
    category: "Website",
    liveUrl: "",
    tileSrc: "",
    tileMobileSrc: "",
    blurSrc: "",
    detailDesktopSrc: "",
    detailMobileSrc: "",
    description: "",
    highlights: [],
    featured: false,
    enabled: true,
  };
}
