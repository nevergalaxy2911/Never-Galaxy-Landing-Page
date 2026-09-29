/* =============================================================================
 * PUBLIC DATA, server functions that read PUBLISHED rows for the public site.
 * -----------------------------------------------------------------------------
 * Ungated (no requireUnlocked). Use the anon-safe publishable key; public RLS
 * policies restrict them to `published = true` rows.
 *
 * Every function returns `null` (or []) on ANY failure so callers can fall
 * back to the static config in `src/config/site.ts` / per-component defaults.
 * The public site MUST NEVER blank out because Supabase is unreachable.
 *
 * SEO/perf: called from route loaders → runs during SSR → HTML ships with
 * real content, no client waterfalls, LCP unaffected.
 * ========================================================================== */
import { createServerFn } from "@tanstack/react-start";
import type { PricingPlan } from "@/config/site";
import {
  DEFAULT_CATEGORIES,
  sanitizeCategories,
  type PortfolioCategory,
} from "@/lib/portfolio-config";
import { parseYouTubeId } from "@/lib/media-links";
import {
  DEFAULT_ASPECT,
  presetById,
  sanitizeAspectMap,
  type AspectConfig,
} from "@/lib/portfolio-aspect";
import {
  DEFAULT_TESTIMONIALS,
  sanitizeTestimonials,
  type Testimonial,
} from "@/lib/testimonials-config";
import {
  DEFAULT_WEBSITES,
  sanitizeWebsites,
  visibleWebsites,
  type WebsiteEntry,
} from "@/lib/websites-config";

type PricingRow = {
  name: string;
  price_inr: number | null;
  custom_price: string | null;
  price_prefix: string | null;
  cadence: string;
  body: string;
  features: unknown;
  highlighted: boolean;
};

type PortfolioRow = {
  id: string;
  category: string;
  title: string;
  subtitle: string | null;
  url: string | null;
  media_url?: string | null;
  badge: string | null;
  thumb_url: string | null;
  aspect_ratio?: string | null;
  resolution_tag?: string | null;
  featured?: boolean;
};

export type PublicPortfolioItem = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  url: string;
  thumbUrl: string;
  youtubeId?: string;
  /** Card shape chosen in /admin, drives the bento span + media box. */
  aspect: AspectConfig;
  /** Optional quality badge shown on the tile (4K, 1080p, Vector, ...). */
  resolutionTag?: string;
  featured?: boolean;
};


function rowToPlan(r: PricingRow): PricingPlan {
  return {
    name: r.name,
    priceInr: r.price_inr,
    customPrice: r.custom_price ?? undefined,
    pricePrefix: r.price_prefix ?? "",
    cadence: r.cadence,
    body: r.body,
    features: Array.isArray(r.features) ? (r.features as string[]) : [],
    highlighted: !!r.highlighted,
  };
}

function envUrlKey() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

async function client() {
  const env = envUrlKey();
  if (!env) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

export const getPublicPricing = createServerFn({ method: "GET" }).handler(
  async (): Promise<PricingPlan[] | null> => {
    try {
      const sb = await client();
      if (!sb) return null;
      const { data, error } = await sb
        .from("pricing_plans")
        .select("name,price_inr,custom_price,price_prefix,cadence,body,features,highlighted")
        .eq("published", true)
        .order("position");
      if (error || !data || data.length === 0) return null;
      return (data as PricingRow[]).map(rowToPlan);
    } catch {
      return null;
    }
  },
);

export const getPublicPortfolio = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPortfolioItem[] | null> => {
    try {
      const sb = await client();
      if (!sb) {
        console.warn("[getPublicPortfolio] No Supabase client available");
        return null;
      }
      const [itemsRes, aspectsRes] = await Promise.all([
        sb
          .from("portfolio_items")
          .select(
            "id,category,title,subtitle,url,media_url,badge,thumb_url,aspect_ratio,resolution_tag,display_order,position,featured",
          )
          .eq("published", true)
          .order("display_order"),
        sb.from("site_settings").select("value").eq("key", "portfolio.aspects").maybeSingle(),
      ]);
      const { data, error } = itemsRes;
      if (error) {
        console.error("[getPublicPortfolio] Supabase query error:", error);
        return null;
      }
      if (!data || data.length === 0) {
        console.warn("[getPublicPortfolio] No published items found in database");
        return null;
      }
      const aspects = aspectsRes.error
        ? {}
        : sanitizeAspectMap((aspectsRes.data as { value: unknown } | null)?.value);
      return (data as PortfolioRow[]).map((r) => {
        // media_url is the canonical link written by /admin; `url` is its
        // legacy mirror, kept for rows saved before the rebuild.
        const url = r.media_url || r.url || "";
        const ytId = parseYouTubeId(url);
        // Card shape: the ratio picked in /admin wins; the older per-item
        // aspects map is the fallback so nothing loses its shape.
        const preset = r.aspect_ratio ? presetById(r.aspect_ratio) : undefined;
        const aspect = preset
          ? { ratio: preset.id, width: preset.width, height: preset.height, size: aspects[r.id]?.size ?? "m" as const }
          : aspects[r.id] ?? { ...DEFAULT_ASPECT };
        return {
          id: r.id,
          category: r.category,
          title: r.title,
          subtitle: r.subtitle ?? "",
          url,
          thumbUrl: r.thumb_url || (ytId ? `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg` : ""),
          youtubeId: ytId || undefined,
          aspect,
          resolutionTag: r.resolution_tag ?? "",
          featured: !!r.featured,
        };
      });
    } catch (e) {
      console.error("[getPublicPortfolio] Unexpected crash:", e);
      return null;
    }
  },
);

/**
 * Public read for testimonials. Stored as one `site_settings` row:
 * `key = 'testimonials.items'`, `value = Testimonial[]`. Falls back to the
 * built-in list on ANY failure so the Reviews section is never empty.
 */
export const getPublicTestimonials = createServerFn({ method: "GET" }).handler(
  async (): Promise<Testimonial[]> => {
    try {
      const sb = await client();
      if (!sb) return DEFAULT_TESTIMONIALS;
      const { data, error } = await sb
        .from("site_settings")
        .select("value")
        .eq("key", "testimonials.items")
        .maybeSingle();
      if (error || !data) return DEFAULT_TESTIMONIALS;
      return sanitizeTestimonials((data as { value: unknown }).value).filter((t) => t.enabled);
    } catch {
      return DEFAULT_TESTIMONIALS;
    }
  },
);


/**
 * Public read for portfolio categories/filter tabs. Stored as a single row
 * in site_settings: `key = 'portfolio.categories'`, `value = PortfolioCategory[]`.
 * Falls back to DEFAULT_CATEGORIES on ANY failure so the tab bar always
 * renders.
 */
export const getPublicCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<PortfolioCategory[]> => {
    try {
      const sb = await client();
      if (!sb) return DEFAULT_CATEGORIES;
      const { data, error } = await sb
        .from("site_settings")
        .select("value")
        .eq("key", "portfolio.categories")
        .maybeSingle();
      if (error || !data) return DEFAULT_CATEGORIES;
      return sanitizeCategories((data as { value: unknown }).value);
    } catch {
      return DEFAULT_CATEGORIES;
    }
  },
);

/**
 * Public read for the "Website" showcase + /work/<slug> case studies.
 * Stored as one `site_settings` row: `key = 'portfolio.websites'`.
 * Falls back to the shipped static list on ANY failure, and only returns
 * entries marked visible, so the section is never empty or half-broken.
 */
export const getPublicWebsites = createServerFn({ method: "GET" }).handler(
  async (): Promise<WebsiteEntry[]> => {
    try {
      const sb = await client();
      if (!sb) {
        console.warn("[getPublicWebsites] No Supabase client available, using fallback");
        return visibleWebsites(DEFAULT_WEBSITES);
      }
      const { data, error } = await sb
        .from("site_settings")
        .select("value")
        .eq("key", "portfolio.websites")
        .maybeSingle();
      if (error) {
        console.error("[getPublicWebsites] Supabase error:", error);
        return visibleWebsites(DEFAULT_WEBSITES);
      }
      if (!data) {
        console.warn("[getPublicWebsites] No websites found in database, using fallback");
        return visibleWebsites(DEFAULT_WEBSITES);
      }
      const list = sanitizeWebsites((data as { value: unknown }).value);
      const visible = visibleWebsites(list);
      return visible.length ? visible : visibleWebsites(DEFAULT_WEBSITES);
    } catch (e) {
      console.error("[getPublicWebsites] Unexpected crash:", e);
      return visibleWebsites(DEFAULT_WEBSITES);
    }
  },
);
