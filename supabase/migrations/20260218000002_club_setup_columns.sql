-- ==========================================================
-- CLUB SETUP: Colunas de config do Wizard no tenants
-- ==========================================================

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_audience text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_goal text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_frequency text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_tone text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_upgrades text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_restrictions text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_top_themes text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_setup_done boolean DEFAULT false;
