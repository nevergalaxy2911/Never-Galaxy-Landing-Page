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
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">Never Galaxy · Console</span>
            <nav className="flex gap-1 text-sm">
              <Link
                to="/admin"
                className="px-3 py-1.5 rounded-md hover:bg-white/10"
                activeProps={{ className: "px-3 py-1.5 rounded-md bg-fuchsia-600" }}
              >
                Admin
              </Link>
              <Link
                to="/api-panel"
                className="px-3 py-1.5 rounded-md hover:bg-white/10"
                activeProps={{ className: "px-3 py-1.5 rounded-md bg-fuchsia-600" }}
              >
                API Panel
              </Link>
              <Link to="/" className="px-3 py-1.5 rounded-md hover:bg-white/10">
                ↗ Site
              </Link>
            </nav>
          </div>
          <button
            onClick={onLogout}
            className="text-sm px-3 py-1.5 rounded-md border border-white/15 hover:bg-white/10"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
