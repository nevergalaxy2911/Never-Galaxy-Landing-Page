/**
 * Pathless layout for /admin and /api-panel. beforeLoad checks the gate
 * cookie server-side; unauthorised requests are redirected to /unlock
 * BEFORE any child route renders.
 */
import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { getUnlockState, lockSite } from "@/lib/gate.functions";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_gated")({
  ssr: false, // session cookie flow runs client-side; skip SSR
  beforeLoad: async () => {
    const state = await getUnlockState();
    if (!state.unlocked) throw redirect({ to: "/unlock" });
  },
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: GatedLayout,
});

function GatedLayout() {
  const navigate = useNavigate();
  const lock = useServerFn(lockSite);
  async function onLogout() {
    await lock();
    navigate({ to: "/unlock" });
  }
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 min-w-0">
            <span className="font-semibold truncate">Never Galaxy · Console</span>
            <nav className="flex flex-wrap gap-1 text-sm">
              <Link
                to="/admin"
                className="nav-pill"
                activeProps={{ className: "nav-pill nav-pill-active" }}
              >
                Admin
              </Link>
              <Link
                to="/api-panel"
                className="nav-pill"
                activeProps={{ className: "nav-pill nav-pill-active" }}
              >
                API Panel
              </Link>
              <Link to="/" className="nav-pill">
                ↗ Site
              </Link>
            </nav>
          </div>
          <button onClick={onLogout} className="btn-secondary">
            Log out
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
