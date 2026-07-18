/**
 * /unlock, shared-password gate form for /admin and /api-panel.
 * Public route (no gate). Shows a minimal form, POSTs to unlockSite server fn.
 */
import { createFileRoute, useRouter, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { unlockSite, getUnlockState } from "@/lib/gate.functions";

export const Route = createFileRoute("/unlock")({
  head: () => ({
    meta: [
      { title: "Unlock, Never Galaxy" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UnlockPage,
});

function UnlockPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const unlock = useServerFn(unlockSite);
  const checkState = useServerFn(getUnlockState);

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already unlocked, bounce to /admin.
  useEffect(() => {
    checkState().then((s) => {
      if (s.unlocked) navigate({ to: "/admin" });
    }).catch(() => {});
  }, [checkState, navigate]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await unlock({ data: { password } });
      if (res.ok) {
        await router.invalidate();
        navigate({ to: "/admin" });
      } else {
        setError(res.reason ?? "Wrong password.");
      }
    } catch (err) {
      setError((err as Error).message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen w-full grid place-items-center bg-black text-white px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 shadow-2xl"
      >
        <h1 className="text-2xl font-semibold mb-2">Never Galaxy, Admin</h1>
        <p className="text-sm text-white/60 mb-6">Enter site password to continue.</p>

        <label className="block text-sm mb-2 text-white/80" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-fuchsia-500"
          placeholder="••••••••••"
          autoFocus
        />

        {error && (
          <p className="text-red-400 text-sm mt-3" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="mt-6 w-full rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 font-medium transition-colors"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
        <p className="text-xs text-white/40 mt-4">
          7-day session • encrypted cookie • single shared password
        </p>
      </form>
    </main>
  );
}
