/**
 * Supabase ADMIN client, service role key, BYPASSES RLS.
 *
 * SERVER-ONLY. Never import from a browser-reachable module. The `.server.ts`
 * extension makes TanStack's bundler refuse any client import, failing fast.
 * Import only inside a createServerFn `.handler()` via:
 *   const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function makeAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseAdmin = makeAdmin();
