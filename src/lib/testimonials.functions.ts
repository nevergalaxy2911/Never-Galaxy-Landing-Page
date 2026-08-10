import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function auth() {
  return (await import("./auth.server")).requireAdmin();
}

export const getTestimonials = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { items: [], error: "Supabase not configured" };
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "testimonials.items")
    .maybeSingle();
  
  if (error) return { items: [], error: error.message };
  return { items: (data?.value as any[]) ?? [], error: null };
});

export const saveTestimonials = createServerFn({ method: "POST" })
  .inputValidator((d: { items: any[] }) => d)
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Supabase not configured");
    
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ 
        key: "testimonials.items", 
        value: data.items, 
        updated_at: new Date().toISOString() 
      });
      
    if (error) throw new Error(error.message);
    return { ok: true };
  });
