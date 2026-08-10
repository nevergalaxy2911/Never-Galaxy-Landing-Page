import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function auth() {
  return (await import("./auth.server")).requireAdmin();
}

/**
 * Sanitize and validate portfolio item data.
 */
function sanitizePortfolioItem(d: any) {
  return {
    id: d.id,
    title: String(d.title || "").trim(),
    category: String(d.category || "website"),
    description: String(d.description || ""),
    imageUrl: String(d.imageUrl || ""),
    videoUrl: String(d.videoUrl || ""),
    liveUrl: String(d.liveUrl || ""),
    featured: !!d.featured,
    position: Number(d.position || 0),
    metadata: typeof d.metadata === "object" ? d.metadata : {},
  };
}

export const listPortfolio = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { rows: [], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin.from("portfolio_items").select("*").order("position");
  return { rows: data ?? [], error: error?.message ?? null };
});

export const upsertPortfolio = createServerFn({ method: "POST" })
  .inputValidator((d: any) => {
    if (!d?.title) throw new Error("Title is required");
    return d;
  })
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    
    const row = sanitizePortfolioItem(data);
    const { data: saved, error } = await supabaseAdmin
      .from("portfolio_items")
      .upsert({ ...row, updated_at: new Date().toISOString() })
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    return { ok: true, data: saved };
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
