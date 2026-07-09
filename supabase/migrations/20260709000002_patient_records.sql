-- Fase 5 do roadmap: prontuário clínico (registros privados por paciente,
-- nunca visíveis para a própria paciente).
CREATE TABLE IF NOT EXISTS patient_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  patient_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('encaminhamento', 'evolucao_clinica', 'exame', 'nota', 'observacao')),
  title           TEXT NOT NULL,
  body            TEXT,
  attachment_path TEXT,
  tag_ids         UUID[] DEFAULT '{}',
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_records_patient ON patient_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_records_tenant  ON patient_records(tenant_id);

-- Tags customizáveis por tenant, reutilizáveis entre registros (array de ids
-- em vez de tabela de junção — volume esperado não justifica a complexidade extra).
CREATE TABLE IF NOT EXISTS patient_record_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT 'indigo',
  icon       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_record_tags_tenant ON patient_record_tags(tenant_id);

ALTER TABLE patient_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_record_tags ENABLE ROW LEVEL SECURITY;

-- Apenas o dono do tenant (nutricionista) lê/escreve — mesmo padrão de
-- autorização já usado em todas as tabelas admin-only deste projeto
-- (tenant_id IN owner_id = auth.uid()). Paciente não tem NENHUMA policy
-- aqui, então nenhuma linha é visível para ela em nenhuma circunstância.
DROP POLICY IF EXISTS "patient_records_admin_all" ON patient_records;
CREATE POLICY "patient_records_admin_all" ON patient_records
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "patient_record_tags_admin_all" ON patient_record_tags;
CREATE POLICY "patient_record_tags_admin_all" ON patient_record_tags
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

-- Bucket privado para anexos de prontuário. Sem nenhuma policy de storage.objects
-- de propósito — todo upload/leitura passa pelo service role (server-side, via
-- lib/supabase-admin.ts), nunca client-side, então RLS de storage aqui é
-- "negar tudo por padrão" e isso é o comportamento desejado.
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-records', 'patient-records', false)
ON CONFLICT (id) DO NOTHING;
