-- =============================================================================
-- NEVER GALAXY — SUPABASE SCHEMA
-- -----------------------------------------------------------------------------
-- ONE-TIME SETUP. Run this ENTIRE file inside your Supabase project:
--   1. Go to https://supabase.com → your project → SQL Editor (left sidebar)
--   2. Click "New query"
--   3. Paste this ENTIRE file
--   4. Click "Run"  (should say: Success. No rows returned.)
--
-- Safe to re-run: everything uses IF NOT EXISTS / CREATE OR REPLACE.
-- =============================================================================

-- ---------- 1. site_settings (key/value store for brand, socials, copy) -------
CREATE TABLE IF NOT EXISTS public.site_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon;                 -- public reads
GRANT ALL    ON public.site_settings TO service_role;         -- admin writes
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_settings public read" ON public.site_settings;
CREATE POLICY "site_settings public read" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);

-- ---------- 2. pricing_plans --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position      int  NOT NULL DEFAULT 0,
  name          text NOT NULL,
  price_inr     int,                  -- null => custom / quote-only
  custom_price  text,                 -- e.g. "Custom"
  price_prefix  text DEFAULT '',      -- e.g. "From "
  cadence       text NOT NULL,        -- e.g. "per deliverable"
  body          text NOT NULL,
  features      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  highlighted   boolean NOT NULL DEFAULT false,
  published     boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_plans TO anon;
GRANT ALL    ON public.pricing_plans TO service_role;
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pricing public read" ON public.pricing_plans;
CREATE POLICY "pricing public read" ON public.pricing_plans
  FOR SELECT TO anon, authenticated USING (published = true);

-- ---------- 3. portfolio_items ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position    int  NOT NULL DEFAULT 0,
  category    text NOT NULL,          -- e.g. "video", "motion", "thumb", "web"
  title       text NOT NULL,
  subtitle    text DEFAULT '',
  url         text DEFAULT '',        -- external link (youtube, behance, etc)
  badge       text DEFAULT '',        -- e.g. "Play", "View", "Soon"
  thumb_url   text DEFAULT '',
  published   boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.portfolio_items TO anon;
GRANT ALL    ON public.portfolio_items TO service_role;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portfolio public read" ON public.portfolio_items;
CREATE POLICY "portfolio public read" ON public.portfolio_items
  FOR SELECT TO anon, authenticated USING (published = true);

-- ---------- 4. feature_flags --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  value       jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon;
GRANT ALL    ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flags public read" ON public.feature_flags;
CREATE POLICY "flags public read" ON public.feature_flags
  FOR SELECT TO anon, authenticated USING (true);

-- ---------- 5. contact_submissions (log of contact form messages) ------------
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  message     text NOT NULL,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read        boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.contact_submissions TO service_role;
-- No anon/authenticated grant: only server (service_role) can read these.
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- ---------- 6. page_views (lightweight analytics) -----------------------------
CREATE TABLE IF NOT EXISTS public.page_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path        text NOT NULL,
  referrer    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.page_views TO anon;
GRANT ALL    ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "page_views public insert" ON public.page_views;
CREATE POLICY "page_views public insert" ON public.page_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- =============================================================================
-- DONE. You can now log into /unlock on your site with SITE_PASSWORD.
-- =============================================================================
