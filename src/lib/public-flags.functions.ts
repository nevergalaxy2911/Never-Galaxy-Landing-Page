/**
 * Public read of feature_flags. No auth. Anon SELECT is granted by the
 * `flags public read` RLS policy. Returns both the boolean toggle AND the
 * JSON value column so callers can carry per-flag config (announcement
 * bar text, custom maintenance message, etc.) in one round-trip.
 */
import { createServerFn } from "@tanstack/react-start";

export const getPublicFlag = createServerFn({ method: "GET" })
  .inputValidator((d: { key: string }) => ({ key: String(d?.key ?? "").slice(0, 100) }))
  .handler(async ({ data }) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !anon) return { enabled: null as boolean | null, value: null as any, missing: true };
      const c = createClient(url, anon, { auth: { persistSession: false } });
      const { data: row } = await c
        .from("feature_flags")
        .select("enabled,value,updated_at")
        .eq("key", data.key)
        .maybeSingle();
      const r = row as { enabled: boolean; value: any; updated_at: string | null } | null;
      return {
        enabled: r ? !!r.enabled : null,
        value: r ? r.value : null,
        updatedAt: r?.updated_at ?? null,
        missing: !r,
      };
    } catch {
      return { enabled: null as boolean | null, value: null as any, updatedAt: null as string | null, missing: true };
    }
  });
