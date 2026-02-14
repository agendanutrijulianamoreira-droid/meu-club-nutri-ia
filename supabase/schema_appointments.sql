-- ============================================
-- MEU CLUB NUTRI.AI - APPOINTMENTS SCHEMA
-- Sistema de Agendamento de Consultas
-- ============================================

-- Tabela de Consultas Agendadas
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Relacionamentos
  nutritionist_id UUID REFERENCES nutritionists(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  -- Agendamento
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60 CHECK (duration_minutes > 0),
  
  -- Tipo
  appointment_type TEXT DEFAULT 'consultation' CHECK (appointment_type IN ('consultation', 'followup', 'initial_assessment', 'group_session')),
  is_virtual BOOLEAN DEFAULT true,
  meeting_link TEXT,
  location_address TEXT, -- Para consultas presenciais
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  
  -- Notas
  notes TEXT, -- Notas gerais da consulta
  patient_notes TEXT, -- Notas privadas do nutricionista sobre o paciente
  pre_consultation_form JSONB, -- Formulário preenchido pelo paciente antes da consulta
  
  -- Reminder/Notificações
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  confirmation_sent BOOLEAN DEFAULT false
);

-- Índices para performance
CREATE INDEX idx_appointments_nutritionist ON appointments(nutritionist_id, scheduled_at DESC);
CREATE INDEX idx_appointments_patient ON appointments(patient_id, scheduled_at DESC);
CREATE INDEX idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at) WHERE status IN ('scheduled', 'confirmed');

-- Prevenir double-booking do nutricionista
CREATE UNIQUE INDEX idx_appointments_no_overlap ON appointments(
  nutritionist_id, 
  scheduled_at
) WHERE status NOT IN ('cancelled', 'no_show');

-- Trigger para atualizar updated_at
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função para verificar disponibilidade antes de agendar
CREATE OR REPLACE FUNCTION check_appointment_availability()
RETURNS TRIGGER AS $$
DECLARE
  v_nutritionist RECORD;
  v_slot_end TIMESTAMPTZ;
  v_conflicts INTEGER;
  v_day_of_week INTEGER;
  v_time_of_day TIME;
BEGIN
  -- Apenas validar para novos agendamentos ou mudanças de horário
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.scheduled_at != OLD.scheduled_at) THEN
    
    -- Buscar configurações do nutricionista
    SELECT * INTO v_nutritionist
    FROM nutritionists
    WHERE id = NEW.nutritionist_id AND calendar_enabled = true;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Nutricionista não tem agenda habilitada';
    END IF;
    
    -- Calcular fim do slot
    v_slot_end := NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::INTERVAL;
    
    -- Extrair dia da semana (0=domingo, 6=sábado) e horário
    v_day_of_week := EXTRACT(DOW FROM NEW.scheduled_at);
    v_time_of_day := NEW.scheduled_at::TIME;
    
    -- Verificar se está em horário de trabalho
    IF NOT (v_day_of_week = ANY(
      SELECT jsonb_array_elements_text(v_nutritionist.calendar_settings->'work_days')::INTEGER
    )) THEN
      RAISE EXCEPTION 'Agendamento fora dos dias de trabalho do nutricionista';
    END IF;
    
    -- Verificar horário
    IF v_time_of_day < (v_nutritionist.calendar_settings->>'work_hours_start')::TIME OR
       v_time_of_day >= (v_nutritionist.calendar_settings->>'work_hours_end')::TIME THEN
      RAISE EXCEPTION 'Agendamento fora do horário de trabalho do nutricionista';
    END IF;
    
    -- Verificar conflitos de horário (overlap)
    SELECT COUNT(*) INTO v_conflicts
    FROM appointments
    WHERE nutritionist_id = NEW.nutritionist_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND status NOT IN ('cancelled', 'no_show')
      AND (
        -- Início do novo slot está dentro de um slot existente
        (NEW.scheduled_at >= scheduled_at AND NEW.scheduled_at < scheduled_at + (duration_minutes || ' minutes')::INTERVAL)
        OR
        -- Fim do novo slot está dentro de um slot existente
        (v_slot_end > scheduled_at AND v_slot_end <= scheduled_at + (duration_minutes || ' minutes')::INTERVAL)
        OR
        -- Novo slot engloba completamente um slot existente
        (NEW.scheduled_at <= scheduled_at AND v_slot_end >= scheduled_at + (duration_minutes || ' minutes')::INTERVAL)
      );
    
    IF v_conflicts > 0 THEN
      RAISE EXCEPTION 'Horário conflita com outro agendamento';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointments_check_availability BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION check_appointment_availability();

-- Função para atualizar status automaticamente baseado no horário
CREATE OR REPLACE FUNCTION auto_update_appointment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a consulta estava agendada/confirmada e o horário passou, marcar como no_show
  IF NEW.status IN ('scheduled', 'confirmed') AND 
     NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::INTERVAL < NOW() THEN
    NEW.status := 'no_show';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointments_auto_status BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION auto_update_appointment_status();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Paciente vê apenas suas próprias consultas
CREATE POLICY "Patients see own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

-- Nutricionista vê suas próprias consultas
CREATE POLICY "Nutritionists see own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    nutritionist_id IN (
      SELECT id FROM nutritionists WHERE user_id = auth.uid()
    )
  );

-- Admin do tenant vê todas consultas de seu tenant
CREATE POLICY "Tenant admins see all appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- Paciente pode criar consulta (agendar)
CREATE POLICY "Patients can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid());

-- Nutricionista pode criar consulta (agendar para paciente)
CREATE POLICY "Nutritionists can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    nutritionist_id IN (
      SELECT id FROM nutritionists WHERE user_id = auth.uid()
    )
  );

-- Paciente pode cancelar suas consultas
CREATE POLICY "Patients can cancel appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- Nutricionista pode atualizar suas consultas
CREATE POLICY "Nutritionists can update appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    nutritionist_id IN (
      SELECT id FROM nutritionists WHERE user_id = auth.uid()
    )
  );

-- Admin pode gerenciar todas consultas do tenant
CREATE POLICY "Tenant admins can manage appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- Próximas consultas por nutricionista
CREATE OR REPLACE VIEW upcoming_appointments AS
SELECT 
  a.*,
  p.name as patient_name,
  p.email as patient_email,
  p.avatar_url as patient_avatar,
  n.name as nutritionist_name,
  n.avatar_url as nutritionist_avatar
FROM appointments a
JOIN profiles p ON p.user_id = a.patient_id
JOIN nutritionists n ON n.id = a.nutritionist_id
WHERE a.scheduled_at > NOW()
  AND a.status IN ('scheduled', 'confirmed')
ORDER BY a.scheduled_at ASC;

-- Estatísticas de consultas por nutricionista
CREATE OR REPLACE VIEW nutritionist_appointment_stats AS
SELECT 
  n.id as nutritionist_id,
  n.name as nutritionist_name,
  n.tenant_id,
  COUNT(*) as total_appointments,
  COUNT(*) FILTER (WHERE a.status = 'completed') as completed_appointments,
  COUNT(*) FILTER (WHERE a.status = 'cancelled') as cancelled_appointments,
  COUNT(*) FILTER (WHERE a.status = 'no_show') as no_show_appointments,
  COUNT(*) FILTER (WHERE a.scheduled_at > NOW() AND a.status IN ('scheduled', 'confirmed')) as upcoming_appointments
FROM nutritionists n
LEFT JOIN appointments a ON a.nutritionist_id = n.id
WHERE n.calendar_enabled = true
GROUP BY n.id, n.name, n.tenant_id;

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE appointments IS 'Agendamentos de consultas entre nutricionistas e pacientes';
COMMENT ON COLUMN appointments.scheduled_at IS 'Data e hora da consulta';
COMMENT ON COLUMN appointments.duration_minutes IS 'Duração em minutos';
COMMENT ON COLUMN appointments.is_virtual IS 'Se a consulta é online (true) ou presencial (false)';
COMMENT ON COLUMN appointments.pre_consultation_form IS 'Formulário preenchido pelo paciente antes da consulta';
