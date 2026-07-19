/**
 * Public read of feature_flags. No auth. Anon SELECT is granted by the
 * `flags public read` RLS policy. Used by DeferredAdblockGate to check the
 * master switch before running any probes.
 */
import { createServerFn } from "@tanstack/react-start";

export const getPublicFlag = createServerFn({ method: "GET" })
  .inputValidator((d: { key: string }) => ({ key: String(d?.key ?? "").slice(0, 100) }))
  .handler(async ({ data }) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !anon) return { enabled: null as boolean | null, missing: true };
      const c = createClient(url, anon, { auth: { persistSession: false } });
      const { data: row } = await c
        .from("feature_flags")
        .select("enabled")
        .eq("key", data.key)
        .maybeSingle();
      return { enabled: row ? !!(row as { enabled: boolean }).enabled : null, missing: !row };
    } catch {
      return { enabled: null as boolean | null, missing: true };
    }
  });
