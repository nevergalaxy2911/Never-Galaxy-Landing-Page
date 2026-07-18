/**
 * Supabase BROWSER client, uses the publishable (public) key.
 * Safe to import from React components. All reads/writes go through
 * Row-Level Security, so anon users only see rows explicitly allowed.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Null when env vars are missing (e.g. local dev without .env). Callers must
 * null-check so the site keeps rendering with file-based fallbacks.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
