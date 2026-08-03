/**
 * Self-hosted analytics.
 *   - logPageView({path, referrer, verdict}) is PUBLIC (anon INSERT policy).
 *   - getAnalyticsSummary() is ADMIN-ONLY (requireAdmin).
 *
 * The client fires logPageView on every route change. No cookies, no PII, no
 * third-party. Data lives in public.page_views.
 */
import { createServerFn } from "@tanstack/react-start";
import { hostOf } from "./analytics-util";

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

/* -------------------------------------------------------------------------- */
/* ADMIN: single-day drilldown                                                */
/* -------------------------------------------------------------------------- */
/**
 * getDayAnalytics({ date, tzOffsetMinutes })
 *
 * Returns everything about ONE calendar day, as seen from the admin's own
 * timezone:
 *   • hourly  -> 24 buckets (0..23) of visit counts, for the bar chart
 *   • visits  -> the raw visit log (time, path, referrer), newest first
 *   • paths / referrers -> aggregated top lists for that day
 *
 * WHY tzOffsetMinutes: the browser sends `new Date().getTimezoneOffset()` so
 * "2026-08-03" means the admin's local day, not UTC. Pass 0 to work in UTC.
 *
 * HOW TO MODIFY:
 *   • Cap of rows returned in the log -> LOG_LIMIT below.
 *   • Add a column (country, device...) -> add it to page_views in
 *     SUPABASE_SETUP.sql, then select + map it here.
 */
export const getDayAnalytics = createServerFn({ method: "POST" })
  .inputValidator((d: { date: string; tzOffsetMinutes?: number }) => {
    const date = String(d?.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");
    const raw = Number(d?.tzOffsetMinutes ?? 0);
    // getTimezoneOffset() is within +/- 14h; clamp to stop silly input.
    const tzOffsetMinutes = Number.isFinite(raw) ? Math.max(-840, Math.min(840, Math.trunc(raw))) : 0;
    return { date, tzOffsetMinutes };
  })
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) return { ok: false as const, reason: "Supabase not configured" };

    const LOG_LIMIT = 2000;
    // Local midnight expressed in UTC. getTimezoneOffset() is minutes to ADD
    // to local time to reach UTC, hence the plus.
    const startUtc = new Date(`${data.date}T00:00:00.000Z`).getTime() + data.tzOffsetMinutes * 60_000;
    const endUtc = startUtc + 24 * 60 * 60 * 1000;

    const { data: rows, error } = await supabaseAdmin
      .from("page_views")
      .select("path, referrer, adblock_verdict, created_at")
      .gte("created_at", new Date(startUtc).toISOString())
      .lt("created_at", new Date(endUtc).toISOString())
      .order("created_at", { ascending: false })
      .limit(LOG_LIMIT);
    if (error) return { ok: false as const, reason: error.message };

    const list = rows ?? [];
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    const pathCounts: Record<string, number> = {};
    const refCounts: Record<string, number> = {};

    for (const r of list) {
      const local = new Date(new Date(r.created_at).getTime() - data.tzOffsetMinutes * 60_000);
      const h = local.getUTCHours();
      if (hourly[h]) hourly[h].count++;
      pathCounts[r.path] = (pathCounts[r.path] ?? 0) + 1;
      const ref = r.referrer ? hostOf(r.referrer) : "direct";
      refCounts[ref] = (refCounts[ref] ?? 0) + 1;
    }

    const top = (m: Record<string, number>, n: number) =>
      Object.entries(m)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([key, count]) => ({ key, count }));

    const peak = hourly.reduce((best, h) => (h.count > best.count ? h : best), hourly[0]!);

    return {
      ok: true as const,
      date: data.date,
      total: list.length,
      truncated: list.length >= LOG_LIMIT,
      peakHour: peak.count > 0 ? peak.hour : null,
      hourly,
      topPaths: top(pathCounts, 12),
      topReferrers: top(refCounts, 12),
      visits: list.slice(0, 500).map((r) => ({
        at: r.created_at,
        path: r.path,
        referrer: r.referrer ? hostOf(r.referrer) : null,
      })),
    };
  });
