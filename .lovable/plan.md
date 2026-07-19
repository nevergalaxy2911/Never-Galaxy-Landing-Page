# Admin Panel v2 — Auth, Adblock Toggle, Analytics

## Goals (from your answers)

1. Replace the shared `/unlock` password gate with real **Supabase Auth + roles** (`admin`, `editor`).
2. Keep the current **safe-quorum adblock detector** intact (no Brave regressions).
3. Add an **adblock master switch** (turn the wall on/off live, no redeploy).
4. Add an **analytics dashboard** (visits vs adblock-detected over time).
5. Add **system metrics logging** (route hits, adblock verdicts, contact submissions).

## What changes

### A. Auth migration (breaking, one-time)
- New tables: `app_role` enum (`admin`, `editor`), `user_roles`, `has_role()` security-definer fn.
- New route `/auth` (email/password sign-in, Google optional later).
- New pathless layout `_admin/` that redirects to `/auth` if not signed in **and** not `admin`.
- Retire `/unlock`, `gate.server.ts`, `gate.functions.ts`, `_gated/` layout.
- Keep `SITE_PASSWORD` / `SESSION_SECRET` env vars deletable after cutover.
- First-user bootstrap: SQL snippet in `ADMIN_SETUP.md` to insert your `user_roles` row after signup.

### B. Adblock master switch
- New row in existing `feature_flags`: `adblock_gate_enabled` (bool).
- `AdblockGate.tsx` reads the flag via a public server fn (SSR-safe, anon SELECT on that flag only).
- Admin toggle lives in `/admin` → Flags tab (already exists, just surfaces this key).
- Detector logic in `src/lib/adblockPolicy.ts` **unchanged** — regression tests stay green.

### C. Analytics dashboard
- Reuse existing `page_views` table; add `adblock_verdict` column (`clear` | `blocked` | `null`).
- Client logs a row on route change + on adblock probe completion (fire-and-forget).
- New `/admin/analytics` tab: totals (7d/30d), sparkline of visits vs blocked, top paths.
- Server fn `getAnalyticsSummary()` gated to `admin` role, aggregates via SQL.

### D. System metrics
- New table `system_events` (`kind`, `payload jsonb`, `created_at`) — auth-only insert via server fn.
- Kinds: `contact_submitted`, `adblock_wall_shown`, `admin_login`, `flag_toggled`.
- Simple event log panel in `/admin/analytics` (last 50).

## Files touched

**New:** `src/routes/auth.tsx`, `src/routes/_admin/route.tsx`, `src/routes/_admin/analytics.tsx`, `src/lib/analytics.functions.ts`, `src/lib/roles.functions.ts`, migration SQL.

**Modified:** `AdblockGate.tsx` (read flag), `admin-data.functions.ts` (swap `requireUnlocked` → role check), `_gated/*` → `_admin/*` rename, `ADMIN_SETUP.md`, `MODIFICATION_GUIDE.md`.

**Deleted:** `src/routes/unlock.tsx`, `src/lib/gate.server.ts`, `src/lib/gate.functions.ts`, `src/routes/_gated/`.

## Order of work (one step at a time, I'll pause after each)

1. **Cloud check + schema** — enable Lovable Cloud if not already, run migration (roles, `system_events`, `page_views.adblock_verdict`, `feature_flags` seed).
2. **Auth cutover** — `/auth` page, `_admin` layout, first-user bootstrap doc.
3. **Move existing admin tabs** under `_admin`, retire `/unlock` + gate files.
4. **Adblock master switch** — flag read in `AdblockGate`, toggle in admin.
5. **Analytics logging** — client hook + server fn.
6. **Analytics dashboard tab**.
7. **Docs** — `ADMIN_SETUP.md` rewrite + `MODIFICATION_GUIDE.md` Part 12.

## Trade-offs to confirm before I start

- **Breaking cutover**: your current `SITE_PASSWORD` login stops working the moment step 2 lands. You'll create an account at `/auth`, then run a 1-line SQL to grant yourself `admin`. OK?
- **Google sign-in**: default Lovable Cloud auth is email+password + Google. Want Google enabled from day one, or email-only for now?
- **Analytics scope**: keep it self-hosted in Supabase (privacy-friendly, no cookies, no third party). Vs. plugging Plausible/Umami later. I'm defaulting to self-hosted.
