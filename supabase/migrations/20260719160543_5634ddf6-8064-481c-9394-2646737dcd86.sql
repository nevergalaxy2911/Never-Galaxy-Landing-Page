DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'editor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role     public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL    ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own roles read" ON public.user_roles;
CREATE POLICY "own roles read" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE TABLE IF NOT EXISTS public.site_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL    ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_settings public read" ON public.site_settings;
CREATE POLICY "site_settings public read" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position     int  NOT NULL DEFAULT 0,
  name         text NOT NULL,
  price_inr    int,
  custom_price text,
  price_prefix text DEFAULT '',
  cadence      text NOT NULL,
  body         text NOT NULL,
  features     jsonb NOT NULL DEFAULT '[]'::jsonb,
  highlighted  boolean NOT NULL DEFAULT false,
  published    boolean NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_plans TO anon, authenticated;
GRANT ALL    ON public.pricing_plans TO service_role;
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pricing public read" ON public.pricing_plans;
CREATE POLICY "pricing public read" ON public.pricing_plans
  FOR SELECT TO anon, authenticated USING (published = true);

CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position   int  NOT NULL DEFAULT 0,
  category   text NOT NULL,
  title      text NOT NULL,
  subtitle   text DEFAULT '',
  url        text DEFAULT '',
  badge      text DEFAULT '',
  thumb_url  text DEFAULT '',
  published  boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.portfolio_items TO anon, authenticated;
GRANT ALL    ON public.portfolio_items TO service_role;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portfolio public read" ON public.portfolio_items;
CREATE POLICY "portfolio public read" ON public.portfolio_items
  FOR SELECT TO anon, authenticated USING (published = true);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key        text PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT false,
  value      jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL    ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flags public read" ON public.feature_flags;
CREATE POLICY "flags public read" ON public.feature_flags
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.feature_flags (key, enabled, value)
VALUES ('adblock_gate_enabled', true, null)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  message    text NOT NULL,
  ip         text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read       boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.page_views (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path            text NOT NULL,
  referrer        text,
  adblock_verdict text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS adblock_verdict text;
CREATE INDEX IF NOT EXISTS page_views_created_idx ON public.page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS page_views_verdict_idx ON public.page_views (adblock_verdict);
GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT ALL    ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "page_views public insert" ON public.page_views;
CREATE POLICY "page_views public insert" ON public.page_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.system_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_events_created_idx ON public.system_events (created_at DESC);
GRANT ALL ON public.system_events TO service_role;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;