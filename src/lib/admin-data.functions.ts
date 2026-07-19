/**
 * Admin CRUD server functions. Every handler starts with requireAdmin() so
 * only authenticated users with the 'admin' role can call them. The admin
 * client (service role) is loaded lazily inside each handler.
 */
import { createServerFn } from "@tanstack/react-start";

async function auth() {
  return (await import("./auth.server")).requireAdmin();
}

/* -------------------------------------------------------------------------- */
/* SITE SETTINGS                                                              */
/* -------------------------------------------------------------------------- */

export const listSettings = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin
    .from("site_settings").select("key,value,updated_at").order("key");
  return { rows: data ?? [], error: error?.message ?? null };
});

export const upsertSetting = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; value: unknown }) => {
    if (!d?.key || typeof d.key !== "string" || d.key.length > 100) throw new Error("Invalid key");
    return d;
  })
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("site_settings").upsert(
      { key: data.key, value: data.value as never, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSetting = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data }) => {
    await auth();
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
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [] as any[], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin.from("pricing_plans").select("*").order("position");
  return { rows: data ?? [], error: error?.message ?? null };
});

export const upsertPricing = createServerFn({ method: "POST" })
  .inputValidator((d: any) => {
    if (!d?.name || typeof d.name !== "string") throw new Error("name required");
    return d;
  })
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("pricing_plans").upsert({ ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePricing = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("pricing_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetPricingToDefaults = createServerFn({ method: "POST" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const { PRICING } = await import("@/config/site");
  const { error: delErr } = await supabaseAdmin.from("pricing_plans").delete().not("id", "is", null);
  if (delErr) throw new Error(delErr.message);
  const rows = PRICING.map((p, i) => ({
    position: i, name: p.name, price_inr: p.priceInr,
    custom_price: p.customPrice ?? null, price_prefix: p.pricePrefix ?? "",
    cadence: p.cadence, body: p.body, features: p.features,
    highlighted: p.highlighted, published: true,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin.from("pricing_plans").insert(rows);
  if (error) throw new Error(error.message);
  return { ok: true, count: rows.length };
});

/* -------------------------------------------------------------------------- */
/* PORTFOLIO                                                                  */
/* -------------------------------------------------------------------------- */

export const listPortfolio = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [] as any[], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin.from("portfolio_items").select("*").order("position");
  return { rows: data ?? [], error: error?.message ?? null };
});

export const upsertPortfolio = createServerFn({ method: "POST" })
  .inputValidator((d: any) => {
    if (!d?.title || !d?.category) throw new Error("title + category required");
    return d;
  })
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("portfolio_items").upsert({ ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePortfolio = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await auth();
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
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [] as any[], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin.from("feature_flags").select("*").order("key");
  return { rows: data ?? [], error: error?.message ?? null };
});

export const upsertFlag = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; enabled: boolean; value?: unknown }) => {
    if (!d?.key) throw new Error("key required");
    return d;
  })
  .handler(async ({ data }) => {
    const { userId } = await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logSystemEvent } = await import("./auth.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("feature_flags").upsert(
      { key: data.key, enabled: data.enabled, value: (data.value ?? null) as never, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    void logSystemEvent("flag_toggled", { key: data.key, enabled: data.enabled, by: userId });
    return { ok: true };
  });

export const deleteFlag = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data }) => {
    await auth();
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
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [] as any[], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin
    .from("contact_submissions").select("*")
    .order("created_at", { ascending: false }).limit(200);
  return { rows: data ?? [], error: error?.message ?? null };
});

export const markSubmissionRead = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; read: boolean }) => d)
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("contact_submissions").update({ read: data.read }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const { error } = await supabaseAdmin.from("contact_submissions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/* HEALTH, quick summary for /api-panel                                       */
/* -------------------------------------------------------------------------- */

export const getHealth = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { ok: false, reason: "Supabase not configured" };
  const [settings, pricing, portfolio, flags, subs, views, admins] = await Promise.all([
    supabaseAdmin.from("site_settings").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("pricing_plans").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("portfolio_items").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("feature_flags").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("contact_submissions").select("*", { count: "exact", head: true }).eq("read", false),
    supabaseAdmin.from("page_views").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
  ]);
  return {
    ok: true,
    counts: {
      settings: settings.count ?? 0,
      pricing: pricing.count ?? 0,
      portfolio: portfolio.count ?? 0,
      flags: flags.count ?? 0,
      unreadSubmissions: subs.count ?? 0,
      pageViews: views.count ?? 0,
      admins: admins.count ?? 0,
    },
    env: {
      supabaseUrl: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
      publishableKey: !!process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  };
});

/* -------------------------------------------------------------------------- */
/* PORTFOLIO CATEGORIES (filter tabs)                                         */
/* -------------------------------------------------------------------------- */

export const getCategories = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { DEFAULT_CATEGORIES, sanitizeCategories } = await import("./portfolio-config");
  if (!supabaseAdmin) return { categories: DEFAULT_CATEGORIES, error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin
    .from("site_settings").select("value").eq("key", "portfolio.categories").maybeSingle();
  if (error) return { categories: DEFAULT_CATEGORIES, error: error.message };
  const cats = data ? sanitizeCategories((data as { value: unknown }).value) : DEFAULT_CATEGORIES;
  return { categories: cats, error: null as string | null };
});

export const saveCategories = createServerFn({ method: "POST" })
  .inputValidator((d: { categories: unknown }) => {
    if (!d || !Array.isArray(d.categories)) throw new Error("categories array required");
    return d;
  })
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sanitizeCategories } = await import("./portfolio-config");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    const clean = sanitizeCategories(data.categories);
    const { error } = await supabaseAdmin.from("site_settings").upsert(
      { key: "portfolio.categories", value: clean, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, count: clean.length };
  });
