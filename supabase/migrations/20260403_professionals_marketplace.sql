-- ====================================================================
-- MARKETPLACE DE PROFISSIONAIS + AGENDAMENTO COM COMISSÃO
-- Cole no SQL Editor do Supabase e clique RUN
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. PROFESSIONALS — Nutricionistas, psicólogos, personal trainers
CREATE TABLE IF NOT EXISTS professionals (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES auth.users(id),

  -- Dados pessoais
  name            text NOT NULL,
  email           text,
  phone           text,
  photo_url       text,
  bio             text,

  -- Profissão
  profession      text NOT NULL CHECK (profession IN ('nutricionista', 'psicologo', 'personal', 'medico', 'fisioterapeuta', 'outro')),
  specialty       text,                      -- Ex: "Nutrição esportiva", "TCC", "Musculação"
  registration_id text,                      -- CRN, CRP, CREF, CRM

  -- Atendimento
  is_virtual      boolean DEFAULT true,
  is_in_person    boolean DEFAULT false,
  meeting_link    text,                      -- Link padrão Google Meet/Zoom
  location_address text,
  duration_minutes integer DEFAULT 60,

  -- Preço e comissão
  price_cents     integer NOT NULL DEFAULT 0, -- Valor da consulta em centavos (R$ 150,00 = 15000)
  commission_pct  numeric(5,2) DEFAULT 50.00, -- Porcentagem de repasse para a plataforma (padrão 50%)
  
  -- Disponibilidade (dias da semana + horários)
  availability    jsonb DEFAULT '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
  -- Formato: {"mon":["09:00","10:00","11:00","14:00","15:00"], "tue":["09:00","10:00"], ...}

  -- Status
  is_active       boolean DEFAULT true,
  is_featured     boolean DEFAULT false,     -- Destaque na listagem
  rating          numeric(3,2) DEFAULT 0,    -- Avaliação média (0-5)
  total_sessions  integer DEFAULT 0,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_professionals_tenant ON professionals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_professionals_profession ON professionals(profession);
CREATE INDEX IF NOT EXISTS idx_professionals_active ON professionals(is_active) WHERE is_active = true;

ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "professionals_public_read" ON professionals FOR SELECT USING (
    is_active = true AND tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "professionals_admin_all" ON professionals FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist'))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2. PROFESSIONAL_BOOKINGS — Agendamentos com tracking financeiro
CREATE TABLE IF NOT EXISTS professional_bookings (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  professional_id   uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  patient_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Agendamento
  scheduled_at      timestamptz NOT NULL,
  duration_minutes  integer DEFAULT 60,
  is_virtual        boolean DEFAULT true,
  meeting_link      text,

  -- Status
  status            text DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Aguardando confirmação do profissional
    'confirmed',      -- Profissional confirmou
    'completed',      -- Sessão realizada
    'cancelled_patient',   -- Paciente cancelou
    'cancelled_professional', -- Profissional cancelou
    'no_show'         -- Não compareceu
  )),
  confirmed_at      timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  cancellation_reason text,

  -- Financeiro
  price_cents       integer NOT NULL DEFAULT 0,       -- Valor total cobrado
  commission_pct    numeric(5,2) NOT NULL DEFAULT 50,  -- % da plataforma no momento da compra
  platform_amount   integer NOT NULL DEFAULT 0,        -- Valor plataforma em centavos
  professional_amount integer NOT NULL DEFAULT 0,      -- Valor profissional em centavos (repasse)
  payment_status    text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  payment_method    text,                              -- 'stripe', 'pix', 'manual'
  stripe_payment_id text,

  -- Repasse
  payout_status     text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  payout_date       timestamptz,
  payout_reference  text,                              -- Comprovante/referência do repasse

  -- Avaliação
  rating            integer CHECK (rating >= 1 AND rating <= 5),
  review_text       text,
  rated_at          timestamptz,

  -- Notas
  patient_notes     text,                              -- Notas do paciente antes da sessão
  professional_notes text,                             -- Notas do profissional após a sessão

  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON professional_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_professional ON professional_bookings(professional_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_patient ON professional_bookings(patient_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON professional_bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payout ON professional_bookings(payout_status) WHERE payout_status = 'pending';

ALTER TABLE professional_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "bookings_patient_select" ON professional_bookings FOR SELECT
    USING (patient_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "bookings_patient_insert" ON professional_bookings FOR INSERT
    WITH CHECK (patient_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "bookings_patient_update" ON professional_bookings FOR UPDATE
    USING (patient_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "bookings_admin_all" ON professional_bookings FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist'))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 3. Trigger para calcular split automaticamente no INSERT
CREATE OR REPLACE FUNCTION calculate_booking_split()
RETURNS TRIGGER AS $$
BEGIN
  NEW.platform_amount := ROUND(NEW.price_cents * (NEW.commission_pct / 100));
  NEW.professional_amount := NEW.price_cents - NEW.platform_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_booking_split ON professional_bookings;
CREATE TRIGGER tr_booking_split
  BEFORE INSERT OR UPDATE OF price_cents, commission_pct ON professional_bookings
  FOR EACH ROW EXECUTE FUNCTION calculate_booking_split();


-- 4. Trigger para atualizar rating e total_sessions do profissional
CREATE OR REPLACE FUNCTION update_professional_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE professionals SET
      total_sessions = total_sessions + 1,
      updated_at = now()
    WHERE id = NEW.professional_id;
  END IF;

  IF NEW.rating IS NOT NULL AND (OLD IS NULL OR OLD.rating IS NULL) THEN
    UPDATE professionals SET
      rating = (
        SELECT ROUND(AVG(rating)::numeric, 2)
        FROM professional_bookings
        WHERE professional_id = NEW.professional_id AND rating IS NOT NULL
      ),
      updated_at = now()
    WHERE id = NEW.professional_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_professional_stats ON professional_bookings;
CREATE TRIGGER tr_professional_stats
  AFTER INSERT OR UPDATE OF status, rating ON professional_bookings
  FOR EACH ROW EXECUTE FUNCTION update_professional_stats();


-- 5. Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_professionals_updated ON professionals;
CREATE TRIGGER tr_professionals_updated BEFORE UPDATE ON professionals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_bookings_updated ON professional_bookings;
CREATE TRIGGER tr_bookings_updated BEFORE UPDATE ON professional_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 6. Comentários
COMMENT ON TABLE professionals IS 'Profissionais cadastrados no marketplace — nutricionistas, psicólogos, personal trainers';
COMMENT ON TABLE professional_bookings IS 'Agendamentos com tracking financeiro — comissão 50% plataforma / 50% profissional';
COMMENT ON COLUMN professionals.price_cents IS 'Valor em centavos. R$150 = 15000';
COMMENT ON COLUMN professionals.commission_pct IS 'Porcentagem retida pela plataforma. Padrão: 50%';
COMMENT ON COLUMN professional_bookings.platform_amount IS 'Valor da plataforma em centavos — calculado automaticamente pelo trigger';
COMMENT ON COLUMN professional_bookings.professional_amount IS 'Valor de repasse ao profissional em centavos — calculado automaticamente';

-- ✅ Pronto! Tabelas do marketplace criadas.
