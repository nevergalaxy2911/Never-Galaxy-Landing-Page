-- =============================================================================
-- NEVER GALAXY COMPLETE BACKEND BLUEPRINT (V7.1 - IDEMPOTENT)
-- -----------------------------------------------------------------------------
-- This script prepares a standard Supabase project for the Never Galaxy app.
-- Updated to be "Idempotent" (can be run multiple times without errors).
-- 
-- USAGE:
-- 1. Go to Supabase Dashboard -> SQL Editor
-- 2. Paste this entire script
-- 3. Run it.
-- 4. In the final INSERT statement, the script uses a specific User ID 
--    found during the setup process. Confirm this matches your ID in 
--    'Authentication -> Users' if you manually login.
-- =============================================================================

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'user');
  END IF;
END $$;

-- 2. USER ROLES (Security Foundation)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Users can read their own roles') THEN
    CREATE POLICY "Users can read their own roles" ON public.user_roles
        FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. SECURITY DEFINER FUNCTION (Role Checking)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. SITE SETTINGS (Dynamic Config)
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
GRANT ALL ON public.site_settings TO authenticated;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Public read access for site settings') THEN
    CREATE POLICY "Public read access for site settings" ON public.site_settings
        FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Admins can manage site settings') THEN
    CREATE POLICY "Admins can manage site settings" ON public.site_settings
        FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 5. PRICING PLANS
CREATE TABLE IF NOT EXISTS public.pricing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position INT NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    price_inr INT,
    custom_price TEXT,
    price_prefix TEXT DEFAULT '',
    cadence TEXT NOT NULL,
    body TEXT NOT NULL,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    highlighted BOOLEAN NOT NULL DEFAULT false,
    published BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pricing_plans TO anon, authenticated;
GRANT ALL ON public.pricing_plans TO service_role;
GRANT ALL ON public.pricing_plans TO authenticated;
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pricing_plans' AND policyname = 'Public read for published pricing') THEN
    CREATE POLICY "Public read for published pricing" ON public.pricing_plans
        FOR SELECT TO anon, authenticated USING (published = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pricing_plans' AND policyname = 'Admins can manage pricing') THEN
    CREATE POLICY "Admins can manage pricing" ON public.pricing_plans
        FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 6. PORTFOLIO ITEMS
CREATE TABLE IF NOT EXISTS public.portfolio_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position INT NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    url TEXT DEFAULT '',
    badge TEXT DEFAULT '',
    thumb_url TEXT DEFAULT '',
    featured BOOLEAN DEFAULT false,
    published BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portfolio_items TO anon, authenticated;
GRANT ALL ON public.portfolio_items TO service_role;
GRANT ALL ON public.portfolio_items TO authenticated;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portfolio_items' AND policyname = 'Public read for published portfolio') THEN
    CREATE POLICY "Public read for published portfolio" ON public.portfolio_items
        FOR SELECT TO anon, authenticated USING (published = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portfolio_items' AND policyname = 'Admins can manage portfolio') THEN
    CREATE POLICY "Admins can manage portfolio" ON public.portfolio_items
        FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 7. CONTACT SUBMISSIONS (Inquiries)
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    budget TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    ip TEXT,
    user_agent TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_submissions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_submissions' AND policyname = 'Admins can manage submissions') THEN
    CREATE POLICY "Admins can manage submissions" ON public.contact_submissions
        FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 8. ANALYTICS (Page Views & Events)
CREATE TABLE IF NOT EXISTS public.page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path TEXT NOT NULL,
    referrer TEXT,
    adblock_verdict TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'page_views' AND policyname = 'Public can insert page views') THEN
    CREATE POLICY "Public can insert page views" ON public.page_views
        FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_events' AND policyname = 'Admins can view system events') THEN
    CREATE POLICY "Admins can view system events" ON public.system_events
        FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 9. FEATURE FLAGS
CREATE TABLE IF NOT EXISTS public.feature_flags (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT false,
    value JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feature_flags' AND policyname = 'Public read for feature flags') THEN
    CREATE POLICY "Public read for feature flags" ON public.feature_flags
        FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- 10. INITIAL SEED DATA
INSERT INTO public.feature_flags (key, enabled) 
VALUES ('adblock_gate_enabled', true)
ON CONFLICT (key) DO NOTHING;

-- BOOTSTRAP ADMIN: 
-- This grants admin role to your specific user ID.
INSERT INTO public.user_roles (user_id, role)
VALUES ('b88cdead-a797-489f-b51d-f07f60394a5b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
