/**
 * PUBLIC (no gate), logs a contact form submission to Supabase.
 * Called from the Contact section in addition to (not instead of) Web3Forms.
 * Fails silently on the client, never blocks the form UX.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";

export const logContactSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; email: string; message: string }) => {
    const clean = {
      name: String(d?.name ?? "").slice(0, 100).trim(),
      email: String(d?.email ?? "").slice(0, 200).trim(),
      message: String(d?.message ?? "").slice(0, 5000).trim(),
    };
    if (!clean.name || !clean.email || clean.message.length < 3) {
      throw new Error("Invalid submission");
    }
    return clean;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) return { ok: false, reason: "not-configured" };
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
      ua = getRequestHeader("user-agent") ?? null;
    } catch { /* not in request scope */ }
    const { error } = await supabaseAdmin.from("contact_submissions").insert({
      name: data.name,
      email: data.email,
      message: data.message,
      ip,
      user_agent: ua,
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  });
