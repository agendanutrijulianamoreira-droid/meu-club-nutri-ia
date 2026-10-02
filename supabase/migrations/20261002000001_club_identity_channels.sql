-- Clube: identidade pública e canais de comunidade.
-- Migração incremental; não executar schema_core.sql novamente em bancos existentes.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_name text,
  ADD COLUMN IF NOT EXISTS public_identity_mode text NOT NULL DEFAULT 'name',
  ADD COLUMN IF NOT EXISTS avatar_config jsonb,
  ADD COLUMN IF NOT EXISTS hide_face_default boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_public_identity_mode_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_public_identity_mode_check
  CHECK (public_identity_mode IN ('name', 'nickname', 'avatar'));

CREATE TABLE IF NOT EXISTS public.community_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES public.community_channels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_community_channels_tenant_active
  ON public.community_channels(tenant_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_community_posts_channel_created
  ON public.community_posts(channel_id, created_at DESC);

ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_channels_read_tenant ON public.community_channels;
CREATE POLICY community_channels_read_tenant
  ON public.community_channels FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.tenant_id = community_channels.tenant_id
  ));

DROP POLICY IF EXISTS community_channels_manage_staff ON public.community_channels;
CREATE POLICY community_channels_manage_staff
  ON public.community_channels FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = community_channels.tenant_id
        AND lower(coalesce(p.role, '')) IN ('admin', 'nutritionist', 'nutri', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = community_channels.tenant_id
        AND lower(coalesce(p.role, '')) IN ('admin', 'nutritionist', 'nutri', 'moderator')
    )
  );

-- Canais padrão para tenants já existentes. Tenants novos podem criá-los pelo Studio.
INSERT INTO public.community_channels (tenant_id, name, slug, description, sort_order)
SELECT t.id, defaults.name, defaults.slug, defaults.description, defaults.sort_order
FROM public.tenants t
CROSS JOIN (VALUES
  ('Geral', 'geral', 'Conversas e apoio da comunidade.', 10),
  ('Desafios', 'desafios', 'Missões e atividades em andamento.', 20),
  ('Receitas', 'receitas', 'Ideias práticas para a rotina.', 30),
  ('Conquistas', 'conquistas', 'Compartilhe suas vitórias.', 40),
  ('Dúvidas', 'duvidas', 'Perguntas para a equipe e a comunidade.', 50),
  ('Avisos', 'avisos', 'Comunicados oficiais do clube.', 60)
) AS defaults(name, slug, description, sort_order)
WHERE COALESCE(t.is_active, true)
ON CONFLICT (tenant_id, slug) DO NOTHING;
