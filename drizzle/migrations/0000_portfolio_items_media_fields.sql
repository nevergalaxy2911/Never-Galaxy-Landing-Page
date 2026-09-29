-- Additive fields for the rebuilt Work manager.
-- `url`/`position` stay in place (the live site still reads them); the new
-- columns are the canonical names the admin panel writes, kept in sync.
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT '16:9',
  ADD COLUMN IF NOT EXISTS resolution_tag text,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

UPDATE public.portfolio_items
   SET media_url = COALESCE(media_url, url),
       display_order = COALESCE(display_order, position),
       aspect_ratio = COALESCE(aspect_ratio, '16:9');

CREATE INDEX IF NOT EXISTS portfolio_items_display_order_idx
  ON public.portfolio_items (display_order);

COMMENT ON COLUMN public.portfolio_items.url IS 'Legacy mirror of media_url, kept in sync by the admin panel.';
COMMENT ON COLUMN public.portfolio_items.position IS 'Legacy mirror of display_order, kept in sync by the admin panel.';
