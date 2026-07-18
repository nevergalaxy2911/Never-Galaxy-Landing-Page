/**
 * Admin CRUD server functions — every handler starts with requireUnlocked()
 * so nothing can be called without a valid gate cookie.
 *
 * Uses the service-role admin client (bypasses RLS). Loaded lazily inside
 * each handler so this module stays safe to import from client bundles.
 */
import { createServerFn } from "@tanstack/react-start";
// requireUnlocked is dynamically imported inside each handler (server-only)

/* -------------------------------------------------------------------------- */
/* SITE SETTINGS (key/value blob)                                             */
/* -------------------------------------------------------------------------- */

export const listSettings = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./gate.server")).requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("key,value,updated_at")
    .order("key");
  return { rows: data ?? [], error: error?.message ?? null };
});

export const upsertSetting = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; value: unknown }) => {
    if (!d?.key || typeof d.key !== "string" || d.key.length > 100) {
      throw new Error("Invalid key");
    }
    return d;
  })
  .handler(async ({ data }) => {
    await (await import("./gate.server")).requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert(
        { key: data.key, value: data.value, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSetting = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./gate.server")).requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("site_settings").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/* PRICING PLANS                                                              */
/* -------------------------------------------------------------------------- */

export const listPricing = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./gate.server")).requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [] as any[], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin
    .from("pricing_plans")
    .select("*")
    .order("position");
  return { rows: data ?? [], error: error?.message ?? null };
});

export const upsertPricing = createServerFn({ method: "POST" })
  .inputValidator((d: any) => {
    if (!d?.name || typeof d.name !== "string") throw new Error("name required");
    return d;
  })
  .handler(async ({ data }) => {
    await (await import("./gate.server")).requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const row = { ...data, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("pricing_plans").upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePricing = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./gate.server")).requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("pricing_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/* PORTFOLIO                                                                  */
/* -------------------------------------------------------------------------- */

export const listPortfolio = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./gate.server")).requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [] as any[], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin
    .from("portfolio_items")
    .select("*")
    .order("position");
  return { rows: data ?? [], error: error?.message ?? null };
});

export const upsertPortfolio = createServerFn({ method: "POST" })
  .inputValidator((d: any) => {
    if (!d?.title || !d?.category) throw new Error("title + category required");
    return d;
  })
  .handler(async ({ data }) => {
    await (await import("./gate.server")).requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const row = { ...data, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("portfolio_items").upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePortfolio = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./gate.server")).requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("portfolio_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/* FEATURE FLAGS                                                              */
/* -------------------------------------------------------------------------- */

export const listFlags = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./gate.server")).requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [] as any[], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("*")
    .order("key");
  return { rows: data ?? [], error: error?.message ?? null };
});

export const upsertFlag = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; enabled: boolean; value?: unknown }) => {
    if (!d?.key) throw new Error("key required");
    return d;
  })
  .handler(async ({ data }) => {
    await (await import("./gate.server")).requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("feature_flags").upsert(
      {
        key: data.key,
        enabled: data.enabled,
        value: data.value ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFlag = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./gate.server")).requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("feature_flags").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/* CONTACT SUBMISSIONS                                                        */
/* -------------------------------------------------------------------------- */

export const listSubmissions = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./gate.server")).requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [] as any[], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin
    .from("contact_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return { rows: data ?? [], error: error?.message ?? null };
});

export const markSubmissionRead = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; read: boolean }) => d)
  .handler(async ({ data }) => {
    await (await import("./gate.server")).requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin
      .from("contact_submissions")
      .update({ read: data.read })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./gate.server")).requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin
      .from("contact_submissions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/* HEALTH — quick summary for /api-panel                                      */
/* -------------------------------------------------------------------------- */

export const getHealth = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./gate.server")).requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { ok: false, reason: "Supabase not configured" };

  const [settings, pricing, portfolio, flags, subs] = await Promise.all([
    supabaseAdmin.from("site_settings").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("pricing_plans").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("portfolio_items").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("feature_flags").select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("contact_submissions")
      .select("*", { count: "exact", head: true })
      .eq("read", false),
  ]);
  return {
    ok: true,
    counts: {
      settings: settings.count ?? 0,
      pricing: pricing.count ?? 0,
      portfolio: portfolio.count ?? 0,
      flags: flags.count ?? 0,
      unreadSubmissions: subs.count ?? 0,
    },
    env: {
      supabaseUrl: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
      publishableKey: !!process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      sitePassword: !!process.env.SITE_PASSWORD,
      sessionSecret: !!process.env.SESSION_SECRET,
    },
  };
});
