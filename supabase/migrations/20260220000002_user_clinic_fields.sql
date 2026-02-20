-- ==========================================================
-- MIGRATION: New Profile, Clinic, and Public Settings Fields
-- Date: 2026-02-20
-- ==========================================================

-- 1. Profiles Table Updates
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS honorific text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license_state text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialty text;
-- Phone and avatar_url already exist in core schema, but ensure they are there
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Tenants Table Updates
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS clinic_phone text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS clinic_whatsapp text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS clinic_address text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS clinic_instagram text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#6366f1'; -- indigo-500
-- Logo url already exists, but ensure it is there
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url text;

-- P0 Wizard Alignment (Pillars & Format)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_pillars text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_format text;

-- 3. Public Settings Table (for Login Customization)
CREATE TABLE IF NOT EXISTS public.public_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for public_settings
ALTER TABLE public.public_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for public_settings" ON public.public_settings;
CREATE POLICY "Public read access for public_settings"
ON public.public_settings FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Service role management for public_settings" ON public.public_settings;
-- Service role always has access, but for explicit admin management:
CREATE POLICY "Admins can manage public_settings"
ON public.public_settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Default Login Config
INSERT INTO public.public_settings (key, value)
VALUES ('login_config', '{
  "template": "clean",
  "background_url": "https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&q=80",
  "headline": "O portal definitivo para a Nutricionista do Futuro.",
  "subheadline": "Gestão, gamificação e IA em um só lugar.",
  "cta_text": "Começar Jornada Grátis",
  "cta_link": "/cadastro",
  "badge_text": "Black Edition",
  "bullets": [
    "Gamificação que retém pacientes",
    "IA que gera protocolos em segundos",
    "Sua marca em evidência"
  ]
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
