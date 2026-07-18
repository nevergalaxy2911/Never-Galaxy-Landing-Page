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
  badge: string | null;
  thumb_url: string | null;
};

export type PublicPortfolioItem = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  url: string;
  thumbUrl: string;
  youtubeId?: string;
};

function parseYouTubeId(u: string): string | undefined {
  try {
    const url = new URL(u);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1) || undefined;
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      const m = url.pathname.match(/\/embed\/([^/?#]+)/);
      if (m) return m[1];
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

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
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
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
      if (!sb) return null;
      const { data, error } = await sb
        .from("portfolio_items")
        .select("id,category,title,subtitle,url,badge,thumb_url")
        .eq("published", true)
        .order("position");
      if (error || !data || data.length === 0) return null;
      return (data as PortfolioRow[]).map((r) => {
        const url = r.url ?? "";
        return {
          id: r.id,
          category: r.category,
          title: r.title,
          subtitle: r.subtitle ?? "",
          url,
          thumbUrl: r.thumb_url ?? "",
          youtubeId: parseYouTubeId(url),
        };
      });
    } catch {
      return null;
    }
  },
);
