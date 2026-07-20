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
import { ADMIN_ALLOWLIST } from "@/config/site";

export async function requireAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured (SUPABASE_SERVICE_ROLE_KEY missing).");
  }
  const authHeader = getRequestHeader("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Unauthorized: no bearer token");

  const { data: userRes, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !userRes?.user) throw new Error("Unauthorized: invalid session");

  // Layer 1: email must be verified (blocks unverified signups from ever being admin).
  if (!userRes.user.email_confirmed_at) throw new Error("Forbidden: email not verified");

  // Layer 2: email must be on the hardcoded allowlist in src/config/site.ts.
  const email = (userRes.user.email ?? "").toLowerCase();
  if (!email || !ADMIN_ALLOWLIST.map((e) => e.toLowerCase()).includes(email)) {
    throw new Error("Forbidden: email not on admin allowlist");
  }

  // Layer 3: user_roles row with role='admin'.
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
    await supabaseAdmin.from("system_events").insert({ kind, payload });
  } catch {
    /* swallow, logging must never break the caller */
  }
}
