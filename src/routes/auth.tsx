/**
 * /auth — admin console sign in.
 *
 * Public route, but noindex. Aesthetically matches the site: deep black,
 * galaxy gradient, starfield, glassmorphism card, gradient CTA.
 *
 * Accessibility:
 *  - <main> landmark, single <h1>.
 *  - Password visibility toggle with aria-pressed.
 *  - Error announced via role="alert".
 *  - Caps-Lock hint via keyboard event (no clipboard leaks).
 */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { forwardRef, useEffect, useRef, useState } from "react";
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
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [caps, setCaps] = useState(false);
  const [checking, setChecking] = useState(true);
  const emailRef = useRef<HTMLInputElement>(null);

  // If already signed in, bounce to /admin. Keep a "checking" state so we
  // don't briefly flash the sign-in form to an already-authed admin.
  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [navigate]);

  useEffect(() => { if (!checking) emailRef.current?.focus(); }, [checking]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) { setErr("Auth is not configured."); return; }
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/admin" });
    } catch (e) {
      setErr("Invalid credentials.");
      console.warn("sign-in failed:", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh w-full grid place-items-center overflow-hidden bg-[#04020a] text-white px-4 py-10">
      {/* Cosmic background — pure CSS, no JS cost. Mirrors the site's palette
          without dragging in the heavy starfield canvas. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(168,85,247,0.25),transparent_60%),radial-gradient(900px_500px_at_80%_110%,rgba(34,211,238,0.18),transparent_60%),radial-gradient(600px_400px_at_50%_50%,rgba(236,72,153,0.10),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(1px_1px_at_10%_20%,#fff,transparent_50%),radial-gradient(1px_1px_at_70%_40%,#dbeafe,transparent_50%),radial-gradient(1.5px_1.5px_at_30%_80%,#fef3c7,transparent_50%),radial-gradient(1px_1px_at_85%_75%,#fce7f3,transparent_50%),radial-gradient(1px_1px_at_50%_15%,#fff,transparent_50%),radial-gradient(1.5px_1.5px_at_15%_60%,#c7d2fe,transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,#04020a_85%)]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand mark + eyebrow */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" className="group inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors text-xs uppercase tracking-[0.35em]">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_12px_2px_rgba(232,121,249,0.65)]" />
            Never Galaxy
          </Link>
          <h1 className="mt-3 font-display text-3xl md:text-4xl leading-tight">
            <span className="bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
              Admin Console
            </span>
          </h1>
          <p className="mt-2 text-sm text-white/55 max-w-xs">
            Restricted area. Sign in with your authorised admin account.
          </p>
        </div>

        {/* Glass card with animated gradient border */}
        <div className="relative rounded-2xl p-[1px] bg-[conic-gradient(from_120deg_at_50%_50%,rgba(168,85,247,0.55),rgba(34,211,238,0.35),rgba(236,72,153,0.55),rgba(168,85,247,0.55))]">
          <form
            onSubmit={onSubmit}
            aria-busy={busy || checking}
            className="rounded-2xl bg-[#0a0714]/85 backdrop-blur-xl border border-white/5 p-6 sm:p-8 shadow-[0_30px_80px_-20px_rgba(168,85,247,0.35)]"
          >
            {checking ? (
              <div className="min-h-[220px] grid place-items-center text-white/50 text-sm">
                <span className="inline-flex items-center gap-3">
                  <Spinner /> Checking session…
                </span>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <Field
                    id="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={email}
                    onChange={setEmail}
                    ref={emailRef}
                    placeholder="you@example.com"
                    icon={<IconMail />}
                  />

                  <div>
                    <Field
                      id="password"
                      label="Password"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={setPassword}
                      onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
                      placeholder="••••••••"
                      icon={<IconLock />}
                      trailing={
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          aria-pressed={showPw}
                          aria-label={showPw ? "Hide password" : "Show password"}
                          className="text-white/45 hover:text-white/85 transition-colors text-xs uppercase tracking-widest px-2 py-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60"
                        >
                          {showPw ? "Hide" : "Show"}
                        </button>
                      }
                    />
                    {caps && (
                      <p className="mt-1.5 text-[11px] text-amber-300/90 flex items-center gap-1.5" role="status">
                        <span aria-hidden>⇪</span> Caps Lock is on
                      </p>
                    )}
                  </div>
                </div>

                {err && (
                  <div role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
                    {err}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="group relative mt-6 w-full overflow-hidden rounded-xl px-4 py-3 font-semibold text-white shadow-[0_10px_30px_-8px_rgba(232,121,249,0.55)] transition-transform active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500" />
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span aria-hidden className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-fuchsia-400/40 via-transparent to-cyan-400/40 blur-md opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span className="relative inline-flex items-center justify-center gap-2">
                    {busy ? (<><Spinner /> Signing in…</>) : (<>Sign in <IconArrow /></>)}
                  </span>
                </button>

                <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-white/30">
                  <span className="h-px flex-1 bg-white/10" /> Secure <span className="h-px flex-1 bg-white/10" />
                </div>

              </>
            )}
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/35">
          <Link to="/" className="hover:text-white/70 transition-colors">← Back to site</Link>
        </p>
      </div>
    </main>
  );
}

/* ---------- tiny presentational atoms ---------- */

type FieldProps = {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  required?: boolean;
  minLength?: number;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { id, label, type, value, onChange, placeholder, autoComplete, inputMode,
    required, minLength, icon, trailing, onKeyUp },
  ref,
) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
        {label}
      </span>
      <span className="group relative flex items-center rounded-xl border border-white/10 bg-black/40 focus-within:border-fuchsia-400/60 focus-within:bg-black/60 focus-within:shadow-[0_0_0_4px_rgba(232,121,249,0.12)] transition-all">
        {icon && <span aria-hidden className="pl-3 pr-1 text-white/40">{icon}</span>}
        <input
          id={id}
          ref={ref}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={onKeyUp}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          className="peer w-full bg-transparent px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none"
        />
        {trailing && <span className="pr-2">{trailing}</span>}
      </span>
    </label>
  );
});

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin motion-reduce:animate-none"
    />
  );
}
function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
  );
}
function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
  );
}
function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
  );
}
