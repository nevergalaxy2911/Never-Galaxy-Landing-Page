/**
 * /unlock — shared site-password gate that stands in front of the admin
 * console. Correct password sets an encrypted, HttpOnly session cookie and
 * redirects to /auth (the admin sign-in).
 */
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { unlockSite } from "@/lib/gate.functions";

type Search = { redirect?: string };

export const Route = createFileRoute("/unlock")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Restricted | Never Galaxy" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UnlockPage,
});

function UnlockPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/unlock" });
  const unlock = useServerFn(unlockSite);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await unlock({ data: { password } });
      if (!res.ok) {
        setErr("Incorrect password.");
        setBusy(false);
        return;
      }
      // Safe internal path or default to /auth
      const target =
        redirect && redirect.startsWith("/") && !redirect.startsWith("//")
          ? redirect
          : "/auth";
      window.location.href = target;
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen w-full grid place-items-center bg-black text-white px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 shadow-2xl"
      >
        <h1 className="text-2xl font-semibold mb-1">Restricted area</h1>
        <p className="text-sm text-white/60 mb-6">
          Enter the site password to continue.
        </p>

        <label className="block text-sm mb-2 text-white/80">Password</label>
        <input
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 focus:outline-none focus:border-fuchsia-500"
          placeholder="••••••••"
        />

        {err && (
          <p className="text-red-400 text-sm mt-3" role="alert">
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="mt-6 w-full rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 px-4 py-2.5 font-medium transition-colors"
        >
          {busy ? "…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
