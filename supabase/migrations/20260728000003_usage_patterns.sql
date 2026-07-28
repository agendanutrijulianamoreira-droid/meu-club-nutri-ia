-- Atalhos automáticos: lembra dos padrões que a nutricionista mais repete ao
-- criar Protocolos (título/tipo/pontos de cada tarefa) e Métodos (nome/
-- descrição de cada fase), sugerindo pra próxima vez em vez de digitar do
-- zero toda vez. Contador síncrono incrementado na hora do save, seguindo
-- exatamente o mesmo padrão já usado por content_templates.usage_count
-- (lib/hooks/useContentTemplates.ts) — não precisa de cron/rollup novo.
CREATE TABLE IF NOT EXISTS usage_patterns (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scope         text NOT NULL CHECK (scope IN ('protocol_item', 'method_phase')),
  dedupe_key    text NOT NULL, -- título/nome normalizado (lowercase, trim) — identifica o "mesmo" padrão
  value         jsonb NOT NULL, -- campos pra pré-preencher (ex: {title, item_type, points} ou {name, description})
  usage_count   integer NOT NULL DEFAULT 1,
  last_used_at  timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now(),

  UNIQUE(tenant_id, scope, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_patterns_lookup
  ON usage_patterns(tenant_id, scope, usage_count DESC);

ALTER TABLE usage_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia padrões de uso"
  ON usage_patterns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = usage_patterns.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- Upsert atômico: incrementa usage_count no próprio banco em vez de o client
-- ler a contagem atual (evita perder incrementos concorrentes/estado local
-- desatualizado, já que o client só carrega os top-N padrões, não todos).
-- SECURITY DEFINER pula a RLS da tabela, então a checagem de tenant/role
-- abaixo é obrigatória aqui dentro — sem ela, qualquer usuário autenticado
-- poderia gravar em usage_patterns de outro tenant (mesma classe de bug já
-- corrigida em duplicate_protocol, ver 20260726000001_protocolos_hardening_cross_tenant.sql).
CREATE OR REPLACE FUNCTION record_usage_pattern(
  p_tenant_id uuid,
  p_scope text,
  p_dedupe_key text,
  p_value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.tenant_id = p_tenant_id
      AND profiles.role IN ('admin', 'nutritionist')
  ) THEN
    RAISE EXCEPTION 'not authorized for this tenant';
  END IF;

  INSERT INTO usage_patterns (tenant_id, scope, dedupe_key, value, usage_count, last_used_at)
  VALUES (p_tenant_id, p_scope, p_dedupe_key, p_value, 1, now())
  ON CONFLICT (tenant_id, scope, dedupe_key)
  DO UPDATE SET
    value = EXCLUDED.value,
    usage_count = usage_patterns.usage_count + 1,
    last_used_at = now();
END;
$$;

-- SECURITY DEFINER expõe a função por padrão a anon/authenticated via RPC.
-- O corpo já checa auth.uid()+tenant+role, mas por princípio de menor
-- privilégio, tira o acesso de anon (não-autenticado) e mantém só authenticated.
REVOKE EXECUTE ON FUNCTION record_usage_pattern(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_usage_pattern(uuid, text, text, jsonb) TO authenticated;
