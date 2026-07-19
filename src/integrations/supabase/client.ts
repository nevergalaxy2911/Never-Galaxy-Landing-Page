/**
 * Supabase BROWSER client, uses the publishable (public) key.
 * Safe to import from React components. All reads/writes go through
 * Row-Level Security, so anon users only see rows explicitly allowed.
 *
 * persistSession + autoRefreshToken are ON so /auth sign-in survives page
 * reloads and the access token stays fresh for admin server-fn calls.
 * These options are ignored during SSR (no localStorage), no crash.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: "ng-auth",
          detectSessionInUrl: false,
        },
      })
    : null;
