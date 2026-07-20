/**
 * /auth, email + password sign in / sign up for admin console access.
 * Public route. After sign-in the user is redirected to /admin. First-time
 * accounts must still be granted the 'admin' role via a one-line SQL insert
 * (see SUPABASE_SETUP.sql bootstrap section).
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | Never Galaxy" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});



function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // If already signed in, bounce to /admin.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setErr("Auth is not configured.");
      return;
    }
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/admin" });
    } catch (e) {
      // Generic message, never leak whether the email exists.
      setErr("Invalid credentials.");
      console.warn("sign-in failed:", (e as Error).message);
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
        <h1 className="text-2xl font-semibold mb-1">Never Galaxy | Admin</h1>
        <p className="text-sm text-white/60 mb-6">
          Restricted area. Sign in with your authorised admin account.
        </p>

        <label className="block text-sm mb-2 text-white/80">Email</label>
        <input
          type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 mb-4 focus:outline-none focus:border-fuchsia-500"
          placeholder="you@example.com"
        />

        <label className="block text-sm mb-2 text-white/80">Password</label>
        <input
          type="password" required minLength={8}
          autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 focus:outline-none focus:border-fuchsia-500"
          placeholder="••••••••"
        />

        {err && <p className="text-red-400 text-sm mt-3" role="alert">{err}</p>}

        <button
          type="submit" disabled={busy}
          className="mt-6 w-full rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 px-4 py-2.5 font-medium transition-colors"
        >
          {busy ? "…" : "Sign in"}
        </button>

        <p className="text-xs text-white/40 mt-6 leading-relaxed">
          New accounts cannot be created from this page. To add an admin, edit
          <code> ADMIN_ALLOWLIST </code> in <code>src/config/site.ts</code>, create
          the user in the Supabase dashboard, and insert their UUID into
          <code> user_roles</code>.
        </p>
      </form>
    </main>
  );
}
