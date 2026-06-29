-- ============================================================
-- Migration: Diário Alimentar + Metas do Paciente
-- Fase 1 — Diário com busca TACO e comparação de meta
-- 2026-06-28
-- ============================================================

-- Tabela foods já existe (20260321_foods_meal_plans.sql)
-- Tabela profiles já existe (schema_core.sql)

-- 1. DIÁRIO ALIMENTAR — registros de refeições diárias
CREATE TABLE IF NOT EXISTS diario_alimentar (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data                  date NOT NULL DEFAULT CURRENT_DATE,
  nome_refeicao         text NOT NULL,  -- 'cafe_manha' | 'almoco' | 'lanche' | 'jantar' | 'ceia'
  food_id               uuid REFERENCES foods(id),
  alimento_nome         text NOT NULL,  -- cópia do nome para histórico imutável
  quantidade_gramas     numeric(8,1) NOT NULL,
  calorias_calculadas   numeric(8,1) NOT NULL,
  proteina_calculada    numeric(8,1),
  carboidrato_calculado numeric(8,1),
  lipideos_calculado    numeric(8,1),
  fibra_calculada       numeric(8,1),
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diario_paciente_data ON diario_alimentar(paciente_id, data);

ALTER TABLE diario_alimentar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paciente_proprios_registros" ON diario_alimentar
  FOR ALL USING (auth.uid() = paciente_id);

-- Nutricionista vê registros de seus pacientes via tenant
CREATE POLICY "nutri_ve_diario_pacientes" ON diario_alimentar
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE p.user_id = auth.uid()
        AND p.role IN ('nutritionist', 'admin')
        AND paciente_id IN (
          SELECT user_id FROM profiles WHERE tenant_id = t.id
        )
    )
  );

-- 2. METAS DO PACIENTE — metas calóricas e de macros definidas pela nutri
CREATE TABLE IF NOT EXISTS metas_paciente (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calorias_meta       numeric(8,1) NOT NULL DEFAULT 1800,
  proteina_meta_g     numeric(8,1) DEFAULT 100,
  carboidrato_meta_g  numeric(8,1) DEFAULT 200,
  lipideos_meta_g     numeric(8,1) DEFAULT 60,
  fibra_meta_g        numeric(8,1) DEFAULT 25,
  valida_de           date NOT NULL DEFAULT CURRENT_DATE,
  valida_ate          date,  -- NULL = vigente
  definida_por        uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metas_paciente ON metas_paciente(paciente_id, valida_de);

ALTER TABLE metas_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paciente_ve_proprias_metas" ON metas_paciente
  FOR SELECT USING (auth.uid() = paciente_id);

CREATE POLICY "nutri_gerencia_metas" ON metas_paciente
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE p.user_id = auth.uid()
        AND p.role IN ('nutritionist', 'admin')
    )
  );
