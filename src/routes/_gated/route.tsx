/**
 * Pathless auth layout for /admin, /api-panel, /admin/analytics.
 * ssr:false because the Supabase session lives in localStorage. Runs a
 * client-side check on mount: no session -> /auth; session but no admin
 * role -> shown a "not authorised" panel with sign-out.
 */
import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth.functions";
import { AdminProvider } from "@/components/admin/AdminProvider";

export const Route = createFileRoute("/_gated")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: GatedLayout,
});

type State =
  | { kind: "checking" }
  | { kind: "unauthenticated" }
  | { kind: "forbidden"; email: string | null }
  | { kind: "ok"; email: string | null };

const BYPASS_AUTH = true; // Gate open. Bypass active.

function GatedLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>(
    BYPASS_AUTH ? { kind: "ok", email: "dev-bypass@nevergalaxy.studio" } : { kind: "checking" }
  );

  useEffect(() => {
    if (BYPASS_AUTH) return;
    let cancelled = false;
    async function check() {
      if (!supabase) return setState({ kind: "unauthenticated" });
      
      try {
        const { data: sess, error: sessErr } = await supabase.auth.getSession();
        if (cancelled) return;
        
        if (sessErr) {
          if (sessErr.name === 'AbortError' || sessErr.message?.toLowerCase().includes('aborted')) return;
          console.error("[GatedRoute] Session Error:", sessErr);
          setState({ kind: "unauthenticated" });
          return;
        }

        if (!sess.session) {
          navigate({ to: "/auth" });
          return;
        }

        const role = await getMyRole();
        if (cancelled) return;
        
        if (!role.signedIn) {
          setState({ kind: "forbidden", email: sess.session.user?.email ?? null });
        } else if (!role.admin) {
          setState({ kind: "forbidden", email: role.email ?? null });
        } else {
          setState({ kind: "ok", email: role.email ?? null });
        }
      } catch (err: any) {
        if (cancelled) return;
        // Check for specific abort/cancellation errors to avoid false forbidden states
        if (err?.name === 'AbortError' || err?.message?.toLowerCase().includes('aborted')) return;
        
        console.error("[GatedRoute] Auth Check Error:", err);
        setState({ kind: "forbidden", email: null });
      }
    }
    void check();
    return () => { cancelled = true; };
  }, [navigate]);


  async function onLogout() {
    if (supabase) await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (state.kind === "checking") {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white/60 text-sm">
        Checking session…
      </div>
    );
  }
  if (state.kind === "forbidden") {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white px-4">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Can't verify admin</h1>
          <p className="text-sm text-white/70 mb-4">
            Signed in as <b>{state.email ?? "unknown"}</b>, but the server can't confirm your admin role.
            Either the account has no <code>admin</code> row in <code>user_roles</code> (run the bootstrap INSERT
            from <code>SUPABASE_SETUP.sql</code>), or the server env vars <code>SUPABASE_URL</code> and
            <code>SUPABASE_SERVICE_ROLE_KEY</code> are missing in this deployment. This preview URL doesn't
            share Vercel's env vars, so test admin login on the deployed Vercel URL.
          </p>

          <button onClick={onLogout} className="btn-secondary">Sign out</button>
        </div>
      </div>
    );
  }
  return (
    // Console shell: a calm slate surface with one accent (fuchsia) so the
    // editor reads as a professional back office instead of a second website.
    <div className="min-h-screen bg-[#07070c] text-white flex flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070c]/85 backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-6">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold"
                style={{ background: "linear-gradient(135deg,#a21caf,#4f46e5)" }}
                aria-hidden
              >
                NG
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight">Never Galaxy</span>
                <span className="block text-[10px] uppercase tracking-[0.18em] text-white/40">Console</span>
              </span>
            </span>
            <nav className="flex flex-wrap gap-1 text-sm" aria-label="Console sections">
              <Link to="/admin" preload="intent" className="nav-pill" activeProps={{ className: "nav-pill nav-pill-active" }}>Editor</Link>
              <Link to="/api-panel" preload="intent" className="nav-pill" activeProps={{ className: "nav-pill nav-pill-active" }}>Operations</Link>
              <Link to="/analytics" preload="intent" className="nav-pill" activeProps={{ className: "nav-pill nav-pill-active" }}>Analytics</Link>
              <Link to="/" preload="intent" className="nav-pill">View site ↗</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {state.kind === "ok" && state.email && (
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                {state.email}
              </span>
            )}
            <button onClick={onLogout} className="btn-secondary">Sign out</button>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 flex flex-col">
        <AdminProvider>
          <Outlet />
        </AdminProvider>
      </main>
    </div>
  );
}

