-- ============================================================
-- Arquitetura "Método Clínico" — Sub-fase 1: Fundação
-- Cria Método + Fases (etapas de jornada, configuráveis, sem
-- limite de quantidade) e desacopla fase_paciente do antigo
-- esquema fixo de 6 fases (REINO), que passam a ser candidatas
-- a nome de Protocolo dentro de uma fase (trabalho da sub-fase 3).
-- 2026-07-21
-- ============================================================

-- ============================================================
-- 1. methods — o Método da nutricionista (ex. "Método Corpo de Rainha")
-- ============================================================

CREATE TABLE IF NOT EXISTS methods (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_methods_tenant ON methods(tenant_id);

ALTER TABLE methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read methods"
  ON methods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = methods.tenant_id
    )
  );

CREATE POLICY "Admin manages own methods"
  ON methods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = methods.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

CREATE OR REPLACE FUNCTION update_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_methods_updated_at ON methods;
CREATE TRIGGER trg_methods_updated_at
  BEFORE UPDATE ON methods
  FOR EACH ROW EXECUTE FUNCTION update_methods_updated_at();

-- ============================================================
-- 2. method_phases — etapas da jornada dentro de um método.
--    Fase = evolução da paciente. NÃO é o tipo de intervenção
--    clínica (isso é Protocolo, sub-fase 3) — mantido leve de
--    propósito, sem joins de conteúdo pesados aqui.
-- ============================================================

CREATE TABLE IF NOT EXISTS method_phases (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  method_id   uuid NOT NULL REFERENCES methods(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_method_phases_method ON method_phases(method_id, order_index);
CREATE INDEX IF NOT EXISTS idx_method_phases_tenant ON method_phases(tenant_id);

ALTER TABLE method_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read method_phases"
  ON method_phases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = method_phases.tenant_id
    )
  );

CREATE POLICY "Admin manages own method_phases"
  ON method_phases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = method_phases.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- ============================================================
-- 3. fase_paciente deixa de ser fonte da verdade — passa a
--    referenciar method_phases. Colunas antigas (fase/nome_fase)
--    ficam nullable só para não quebrar leituras em voo; o
--    código para de escrevê-las a partir desta entrega.
--    Tabela está vazia em produção (0 linhas) — sem risco de
--    perda de dado real.
-- ============================================================

ALTER TABLE fase_paciente
  ADD COLUMN IF NOT EXISTS method_phase_id uuid REFERENCES method_phases(id);

CREATE INDEX IF NOT EXISTS idx_fase_paciente_method_phase ON fase_paciente(method_phase_id);

ALTER TABLE fase_paciente ALTER COLUMN fase DROP NOT NULL;
ALTER TABLE fase_paciente ALTER COLUMN nome_fase DROP NOT NULL;
ALTER TABLE fase_paciente DROP CONSTRAINT IF EXISTS fase_paciente_fase_check;

COMMENT ON COLUMN fase_paciente.fase IS 'DEPRECATED (legado REINO 1-6) — use method_phase_id. Mantida nullable só para compatibilidade de leitura.';
COMMENT ON COLUMN fase_paciente.nome_fase IS 'DEPRECATED (legado REINO) — use method_phase_id + method_phases.name. Mantida nullable só para compatibilidade de leitura.';

-- ============================================================
-- 4. meal_plans / meal_plan_assignments — remove o teto fixo de
--    6 fases da CHECK constraint (sem quantidade de fases fixa
--    a partir de agora). Coluna inteira mantida por não haver
--    dado real dependendo dela hoje.
-- ============================================================

ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_fase_aplicada_check;
ALTER TABLE meal_plan_assignments DROP CONSTRAINT IF EXISTS meal_plan_assignments_fase_aplicada_check;

COMMENT ON COLUMN meal_plans.fase_aplicada IS 'DEPRECATED (legado REINO 1-6, sem CHECK). Use method_phase_id do paciente via fase_paciente.';
COMMENT ON COLUMN meal_plan_assignments.fase_aplicada IS 'DEPRECATED (legado REINO 1-6, sem CHECK). Use method_phase_id do paciente via fase_paciente.';

-- ============================================================
-- 5. Seed: cria 1 Método legado + 3 Fases de jornada para cada
--    tenant já existente, usando o modelo corrigido (fase =
--    etapa da jornada; os antigos 6 nomes REINO viram candidatos
--    a Protocolo dentro de uma fase, trabalho da sub-fase 3).
-- ============================================================

DO $$
DECLARE
  t RECORD;
  new_method_id uuid;
BEGIN
  FOR t IN SELECT id, method_name FROM tenants LOOP
    INSERT INTO methods (tenant_id, name, description, is_active)
    VALUES (
      t.id,
      COALESCE(NULLIF(t.method_name, ''), 'Método Padrão'),
      'Método migrado automaticamente do antigo esquema de 6 fases (REINO) na fundação da arquitetura de Método Clínico.',
      true
    )
    RETURNING id INTO new_method_id;

    INSERT INTO method_phases (method_id, tenant_id, name, description, order_index) VALUES
      (new_method_id, t.id, 'Organizando a Morada', 'Primeira etapa da jornada: base de reeducação alimentar e desinflamação.', 0),
      (new_method_id, t.id, 'Corrigindo a Rota', 'Segunda etapa da jornada: ajuste hormonal e metabólico.', 1),
      (new_method_id, t.id, 'Estratégias de Aceleração', 'Terceira etapa da jornada: composição corporal e manutenção.', 2);
  END LOOP;
END $$;
