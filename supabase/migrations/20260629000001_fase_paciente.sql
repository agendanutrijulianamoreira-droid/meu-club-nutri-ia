-- ============================================================
-- Migration: Fase do REINO por Paciente
-- Fase 3 — Notificações Personalizadas por Fase do REINO
-- 2026-06-29
-- ============================================================

CREATE TABLE IF NOT EXISTS fase_paciente (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fase          integer NOT NULL CHECK (fase BETWEEN 1 AND 6),
  -- 1=Anti-inflamatória, 2=Intestinal, 3=Hormonal,
  -- 4=Metabólica, 5=Composição Corporal, 6=Manutenção
  nome_fase     text NOT NULL,
  inicio        date NOT NULL DEFAULT CURRENT_DATE,
  fim           date,                                  -- NULL = vigente
  definida_por  uuid REFERENCES auth.users(id),
  observacoes   text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fase_paciente_pid
  ON fase_paciente(paciente_id, inicio DESC);

ALTER TABLE fase_paciente ENABLE ROW LEVEL SECURITY;

-- Paciente vê sua própria fase
CREATE POLICY "paciente_ve_propria_fase" ON fase_paciente
  FOR SELECT USING (auth.uid() = paciente_id);

-- Nutri/admin do tenant gerencia fases de suas pacientes
CREATE POLICY "nutri_gerencia_fases" ON fase_paciente
  FOR ALL USING (
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

-- ============================================================
-- Tabela de preferências de notificação por paciente
-- Horários preferidos + opt-in por tipo
-- ============================================================

CREATE TABLE IF NOT EXISTS preferencias_notificacao (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  horario_cafe        time DEFAULT '07:30',
  horario_almoco      time DEFAULT '12:00',
  horario_lanche      time DEFAULT '15:30',
  horario_jantar      time DEFAULT '19:00',
  notif_refeicao      boolean DEFAULT true,
  notif_hidratacao    boolean DEFAULT true,
  notif_checkin       boolean DEFAULT true,
  notif_motivacao     boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE preferencias_notificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paciente_gerencia_preferencias" ON preferencias_notificacao
  FOR ALL USING (auth.uid() = paciente_id);

CREATE POLICY "nutri_ve_preferencias" ON preferencias_notificacao
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
