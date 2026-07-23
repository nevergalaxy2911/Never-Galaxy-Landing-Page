/**
 * Portfolio outbound click tracking.
 *
 *   logPortfolioClick({slug, title, url, kind})  - PUBLIC (anon insert)
 *   getPortfolioClickStats()                     - ADMIN ONLY
 *
 * Fires when a visitor opens a portfolio website (either the "Visit site"
 * button in the preview modal, or the tile click that opens the modal).
 * Fire-and-forget on the client, tolerant of failures.
 */
import { createServerFn } from "@tanstack/react-start";

export const logPortfolioClick = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { slug: string; title: string; url: string; kind?: "tile" | "visit" | "preview" }) => {
      const slug = String(d?.slug ?? "").slice(0, 120);
      const title = String(d?.title ?? "").slice(0, 200);
      const url = String(d?.url ?? "").slice(0, 500);
      const kind =
        d?.kind === "tile" || d?.kind === "visit" || d?.kind === "preview" ? d.kind : "tile";
      if (!slug || !url) throw new Error("slug + url required");
      return { slug, title, url, kind };
    },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) return { ok: false };
    try {
      await supabaseAdmin.from("portfolio_clicks").insert({
        slug: data.slug,
        title: data.title,
        url: data.url,
        kind: data.kind,
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export const getPortfolioClickStats = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { ok: false as const, reason: "Supabase not configured" };

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("portfolio_clicks")
    .select("slug, title, url, kind, created_at")
    .gte("created_at", since30)
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) return { ok: false as const, reason: error.message };

  const rows = data ?? [];
  const bySlug: Record<
    string,
    { slug: string; title: string; url: string; total: number; tile: number; visit: number; preview: number; lastAt: string }
  > = {};
  for (const r of rows) {
    const s = (bySlug[r.slug] ??= {
      slug: r.slug,
      title: r.title,
      url: r.url,
      total: 0,
      tile: 0,
      visit: 0,
      preview: 0,
      lastAt: r.created_at,
    });
    s.total++;
    if (r.kind === "tile") s.tile++;
    else if (r.kind === "visit") s.visit++;
    else if (r.kind === "preview") s.preview++;
    if (r.created_at > s.lastAt) s.lastAt = r.created_at;
  }
  const byItem = Object.values(bySlug).sort((a, b) => b.total - a.total);

  return { ok: true as const, total30: rows.length, byItem };
});
