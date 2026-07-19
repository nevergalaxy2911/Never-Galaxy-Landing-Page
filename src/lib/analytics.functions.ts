/**
 * Self-hosted analytics.
 *   - logPageView({path, referrer, verdict}) is PUBLIC (anon INSERT policy).
 *   - getAnalyticsSummary() is ADMIN-ONLY (requireAdmin).
 *
 * The client fires logPageView on every route change and after the adblock
 * probe finishes. No cookies, no PII, no third-party. Data lives in
 * public.page_views.
 */
import { createServerFn } from "@tanstack/react-start";

/* -------------------------------------------------------------------------- */
/* PUBLIC: log a page view                                                    */
/* -------------------------------------------------------------------------- */

export const logPageView = createServerFn({ method: "POST" })
  .inputValidator((d: { path: string; referrer?: string | null; verdict?: string | null }) => {
    const path = String(d?.path ?? "").slice(0, 500);
    const referrer = d?.referrer ? String(d.referrer).slice(0, 500) : null;
    const verdict = d?.verdict === "clear" || d?.verdict === "blocked" ? d.verdict : null;
    if (!path) throw new Error("path required");
    return { path, referrer, verdict };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) return { ok: false };
    try {
      await supabaseAdmin.from("page_views").insert({
        path: data.path,
        referrer: data.referrer,
        adblock_verdict: data.verdict,
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

/* -------------------------------------------------------------------------- */
/* ADMIN: aggregate summary for /admin/analytics                              */
/* -------------------------------------------------------------------------- */

export const getAnalyticsSummary = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { ok: false, reason: "Supabase not configured" };

  const now = Date.now();
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since24 = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  // Pull last-30-day rows once (cap for safety), aggregate in JS.
  const { data: views, error } = await supabaseAdmin
    .from("page_views")
    .select("path, adblock_verdict, created_at")
    .gte("created_at", since30)
    .order("created_at", { ascending: false })
    .limit(50000);
  if (error) return { ok: false, reason: error.message };
  const rows = views ?? [];

  const countIf = (pred: (r: typeof rows[number]) => boolean) => rows.filter(pred).length;
  const total30 = rows.length;
  const total7  = countIf((r) => r.created_at >= since7);
  const total24 = countIf((r) => r.created_at >= since24);
  const blocked30 = countIf((r) => r.adblock_verdict === "blocked");
  const clear30   = countIf((r) => r.adblock_verdict === "clear");

  // Per-day buckets for last 14 days.
  const day = (iso: string) => iso.slice(0, 10);
  const buckets: Record<string, { total: number; blocked: number }> = {};
  for (let i = 13; i >= 0; i--) {
    const k = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    buckets[k] = { total: 0, blocked: 0 };
  }
  for (const r of rows) {
    const k = day(r.created_at);
    if (buckets[k]) {
      buckets[k].total++;
      if (r.adblock_verdict === "blocked") buckets[k].blocked++;
    }
  }
  const daily = Object.entries(buckets).map(([date, v]) => ({ date, ...v }));

  // Top paths (30d).
  const pathCounts: Record<string, number> = {};
  for (const r of rows) pathCounts[r.path] = (pathCounts[r.path] ?? 0) + 1;
  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Recent system events.
  const { data: events } = await supabaseAdmin
    .from("system_events")
    .select("kind, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    ok: true,
    totals: {
      day: total24,
      week: total7,
      month: total30,
      blocked: blocked30,
      clear: clear30,
      blockRate: total30 > 0 ? Math.round((blocked30 / total30) * 1000) / 10 : 0,
    },
    daily,
    topPaths,
    events: events ?? [],
  };
});
