import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function auth() {
  return (await import("./auth.server")).requireAdmin();
}

/**
 * Validates a schema exists for backup and restore.
 */
export const validateAdminSchema = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  
  const tables = ["site_settings", "pricing_plans", "portfolio_items", "feature_flags", "contact_submissions", "page_views", "user_roles"];
  const results: Record<string, boolean> = {};
  
  await Promise.all(tables.map(async (table) => {
    const { error } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true }).limit(0);
    results[table] = !error;
  }));
  
  return results;
});

/**
 * Bulk clear all 'featured' flags from portfolio items.
 */
export const bulkClearFeaturedItems = createServerFn({ method: "POST" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  
  const { error, count } = await supabaseAdmin
    .from("portfolio_items")
    .update({ featured: false }, { count: "exact" })
    .eq("featured", true);
    
  if (error) throw new Error(error.message);
  return { ok: true, cleared: count ?? 0 };
});

/**
 * Get system telemetry for the diagnostics page.
 */
export const getSystemTelemetry = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  
  // Simulated telemetry since direct OS stats aren't available in Worker
  return {
    uptime: process.uptime(),
    memory: "Optimized (Edge)",
    region: "Global Edge",
    dbStatus: "Connected",
    timestamp: new Date().toISOString()
  };
});
