/**
 * Pathless auth layout for /admin, /api-panel, /admin/analytics.
 * ssr:false because the Supabase session lives in localStorage. Runs a
 * client-side check on mount: no session -> /auth; session but no admin
 * role -> shown a "not authorised" panel with sign-out.
 */
import { createFileRoute, Outlet, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth.functions";
import { isUnlocked } from "@/lib/gate.functions";

export const Route = createFileRoute("/_gated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { unlocked } = await isUnlocked();
    if (!unlocked) {
      throw redirect({ to: "/unlock", search: { redirect: location.href } });
    }
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: GatedLayout,
});

type State =
  | { kind: "checking" }
  | { kind: "unauthenticated" }
  | { kind: "forbidden"; email: string | null }
  | { kind: "ok"; email: string | null };

function GatedLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!supabase) return setState({ kind: "unauthenticated" });
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        if (!cancelled) navigate({ to: "/auth" });
        return;
      }
      try {
        const role = await getMyRole();
        if (cancelled) return;
        if (!role.signedIn) navigate({ to: "/auth" });
        else if (!role.admin) setState({ kind: "forbidden", email: role.email ?? null });
        else setState({ kind: "ok", email: role.email ?? null });
      } catch {
        if (!cancelled) setState({ kind: "forbidden", email: null });
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
          <h1 className="text-xl font-semibold mb-2">Not authorised</h1>
          <p className="text-sm text-white/70 mb-4">
            Signed in as <b>{state.email ?? "unknown"}</b>, but this account has no admin role.
            Run the bootstrap INSERT from <code>SUPABASE_SETUP.sql</code> to grant admin access.
          </p>
          <button onClick={onLogout} className="btn-secondary">Sign out</button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 min-w-0">
            <span className="font-semibold truncate">Never Galaxy | Console</span>
            <nav className="flex flex-wrap gap-1 text-sm">
              <Link to="/admin" className="nav-pill" activeProps={{ className: "nav-pill nav-pill-active" }}>Admin</Link>
              <Link to="/api-panel" className="nav-pill" activeProps={{ className: "nav-pill nav-pill-active" }}>API Panel</Link>
              <Link to="/analytics" className="nav-pill" activeProps={{ className: "nav-pill nav-pill-active" }}>Analytics</Link>
              <Link to="/" className="nav-pill">↗ Site</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {state.kind === "ok" && state.email && (
              <span className="text-xs text-white/50 hidden sm:inline">{state.email}</span>
            )}
            <button onClick={onLogout} className="btn-secondary">Sign out</button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
