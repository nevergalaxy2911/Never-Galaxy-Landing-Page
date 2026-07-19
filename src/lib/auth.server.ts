/**
 * SERVER-ONLY auth helpers. Filename (.server.ts) blocks any client import.
 *
 * requireAdmin() validates the request's Authorization: Bearer <access_token>
 * against Supabase Auth (via the admin client), then checks the user_roles
 * table for role='admin'. Throws on any failure. Every admin server fn
 * dynamically imports this from inside its handler.
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function requireAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured (SUPABASE_SERVICE_ROLE_KEY missing).");
  }
  const authHeader = getRequestHeader("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Unauthorized: no bearer token");

  const { data: userRes, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !userRes?.user) throw new Error("Unauthorized: invalid session");

  const { data: roles, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("role", "admin")
    .limit(1);
  if (roleErr) throw new Error("Role check failed: " + roleErr.message);
  if (!roles || roles.length === 0) throw new Error("Forbidden: admin role required");

  return { userId: userRes.user.id, email: userRes.user.email ?? null };
}

/** Log a row into system_events. Fire-and-forget, never throws. */
export async function logSystemEvent(kind: string, payload: unknown = null) {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from("system_events").insert({ kind, payload: payload as never });
  } catch {
    /* swallow, logging must never break the caller */
  }
}
