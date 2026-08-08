
-- CONTACT SUBMISSIONS ENHANCEMENT
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS budget TEXT;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new'; -- 'new', 'replied', 'archived'

-- SYSTEM EVENT LOGGING (for audit)
CREATE TABLE IF NOT EXISTS public.system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can see all events') THEN
        CREATE POLICY "Admins can see all events" ON public.system_events
            FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- PORTFOLIO ITEMS ENHANCEMENT
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS badge_text TEXT;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS video_aspect TEXT DEFAULT '16:9';

-- RE-GRANT Permissions just in case
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

GRANT ALL ON public.contact_submissions TO service_role;
GRANT ALL ON public.portfolio_items TO service_role;
GRANT ALL ON public.pricing_plans TO service_role;
GRANT ALL ON public.site_settings TO service_role;
