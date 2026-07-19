/**
 * Auth-related server fns callable from the client.
 * getMyRole() lets the _gated layout confirm the signed-in user has admin
 * before rendering. Returns { admin: boolean } and never throws (so a signed-
 * out user gets { admin: false } instead of a redirect from the fn itself).
 */
import { createServerFn } from "@tanstack/react-start";

export const getMyRole = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) return { admin: false, signedIn: false };
    const authHeader = getRequestHeader("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { admin: false, signedIn: false };
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { admin: false, signedIn: false };
    const { data: rows } = await supabaseAdmin
      .from("user_roles").select("role")
      .eq("user_id", data.user.id).eq("role", "admin").limit(1);
    return {
      admin: !!rows && rows.length > 0,
      signedIn: true,
      email: data.user.email ?? null,
    };
  } catch {
    return { admin: false, signedIn: false };
  }
});
