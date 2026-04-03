-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  VitaClub — SQL COMPLETO PARA SUPABASE                           ║
-- ║  Cole TUDO de uma vez no SQL Editor do Supabase e clique RUN     ║
-- ║  Ordem: Extensões → Tabelas Agentes → Tabelas Alimentos → Cron  ║
-- ╚══════════════════════════════════════════════════════════════════════╝


-- ====================================================================
-- PARTE 1: EXTENSÃO NECESSÁRIA
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ====================================================================
-- PARTE 2: TABELAS DA ORQUESTRA DE AGENTES IA
-- ====================================================================

-- 2.1 AGENT_LOGS — Log de execução de todos os agentes
CREATE TABLE IF NOT EXISTS agent_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_name    text NOT NULL,
  trigger_type  text NOT NULL,
  input_payload jsonb DEFAULT '{}'::jsonb,
  output_payload jsonb DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'running',
  error_message text,
  tokens_used   integer DEFAULT 0,
  cost_usd      numeric(10,6) DEFAULT 0,
  duration_ms   integer DEFAULT 0,
  model_used    text DEFAULT 'claude-sonnet-4-20250514',
  created_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_tenant ON agent_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user ON agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status ON agent_logs(status);

ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view agent logs for their tenant"
    ON agent_logs FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert agent logs"
    ON agent_logs FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update agent logs"
    ON agent_logs FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 2.2 INBOX_MESSAGES — Mensagens dos agentes para as pacientes
CREATE TABLE IF NOT EXISTS inbox_messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name      text NOT NULL,
  agent_log_id    uuid REFERENCES agent_logs(id) ON DELETE SET NULL,
  title           text NOT NULL,
  body            text NOT NULL,
  message_type    text NOT NULL DEFAULT 'engagement',
  priority        text NOT NULL DEFAULT 'normal',
  cta_label       text,
  cta_url         text,
  channels        text[] DEFAULT ARRAY['inbox'],
  push_sent       boolean DEFAULT false,
  push_sent_at    timestamptz,
  status          text NOT NULL DEFAULT 'unread',
  read_at         timestamptz,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_tenant_user ON inbox_messages(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_user_status ON inbox_messages(user_id, status);
CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_type ON inbox_messages(message_type);

ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own inbox"
    ON inbox_messages FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own messages"
    ON inbox_messages FOR UPDATE
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert inbox messages"
    ON inbox_messages FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view tenant inbox"
    ON inbox_messages FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 2.3 PATIENT_RISK_SCORES — Score de risco diário por paciente
CREATE TABLE IF NOT EXISTS patient_risk_scores (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_risk    integer NOT NULL DEFAULT 0,
  inactivity_risk integer NOT NULL DEFAULT 0,
  adherence_risk  integer NOT NULL DEFAULT 0,
  emotional_risk  integer NOT NULL DEFAULT 0,
  engagement_risk integer NOT NULL DEFAULT 0,
  risk_level      text NOT NULL DEFAULT 'low',
  signals         jsonb DEFAULT '[]'::jsonb,
  recommended_action text,
  action_taken       boolean DEFAULT false,
  days_since_activity integer DEFAULT 0,
  current_streak      integer DEFAULT 0,
  adherence_7d        numeric(5,2) DEFAULT 0,
  last_checkin_score  integer,
  agent_log_id    uuid REFERENCES agent_logs(id) ON DELETE SET NULL,
  calculated_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, calculated_at::date)
);

CREATE INDEX IF NOT EXISTS idx_risk_tenant ON patient_risk_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_risk_user ON patient_risk_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_level ON patient_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_date ON patient_risk_scores(calculated_at DESC);

ALTER TABLE patient_risk_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view risk scores"
    ON patient_risk_scores FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Patients can view own risk score"
    ON patient_risk_scores FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can manage risk scores"
    ON patient_risk_scores FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 2.4 Realtime para inbox
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_messages;


-- ====================================================================
-- PARTE 3: BASE DE ALIMENTOS TACO/TBCA + CARDÁPIOS
-- ====================================================================

-- 3.1 FOODS — Alimentos brasileiros com dados nutricionais reais
CREATE TABLE IF NOT EXISTS foods (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  taco_id       integer,
  name          text NOT NULL,
  name_search   text NOT NULL,
  category      text NOT NULL,
  source        text DEFAULT 'taco',
  energy_kcal       numeric(8,2),
  protein_g         numeric(8,2),
  total_fat_g       numeric(8,2),
  saturated_fat_g   numeric(8,2),
  monounsat_fat_g   numeric(8,2),
  polyunsat_fat_g   numeric(8,2),
  cholesterol_mg    numeric(8,2),
  carbs_g           numeric(8,2),
  fiber_g           numeric(8,2),
  sugar_g           numeric(8,2),
  calcium_mg    numeric(8,2),
  iron_mg       numeric(8,2),
  sodium_mg     numeric(8,2),
  potassium_mg  numeric(8,2),
  magnesium_mg  numeric(8,2),
  phosphorus_mg numeric(8,2),
  zinc_mg       numeric(8,2),
  vitamin_c_mg  numeric(8,2),
  vitamin_a_rae numeric(8,2),
  thiamine_mg   numeric(8,4),
  riboflavin_mg numeric(8,4),
  niacin_mg     numeric(8,4),
  vitamin_b6_mg numeric(8,4),
  serving_size_g    numeric(8,1),
  serving_label     text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(name, source)
);

CREATE INDEX IF NOT EXISTS idx_foods_search ON foods USING gin(name_search gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_foods_category ON foods(category);
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Foods are publicly readable" ON foods FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages foods" ON foods FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 3.2 MEAL_PLANS — Cardápios editáveis
CREATE TABLE IF NOT EXISTS meal_plans (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by    uuid REFERENCES auth.users(id),
  title         text NOT NULL,
  description   text,
  goal          text,
  duration_days integer DEFAULT 7,
  target_kcal       integer,
  target_protein_g  integer,
  target_carbs_g    integer,
  target_fat_g      integer,
  target_fiber_g    integer,
  status        text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_ai_generated boolean DEFAULT false,
  tags          text[] DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_tenant ON meal_plans(tenant_id);
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage meal plans" ON meal_plans FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Patients view published plans" ON meal_plans FOR SELECT
    USING (status = 'published' AND tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 3.3 MEAL_PLAN_ITEMS — Itens vinculados a alimentos reais
CREATE TABLE IF NOT EXISTS meal_plan_items (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_plan_id  uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_number    integer NOT NULL,
  meal_type     text NOT NULL,
  meal_label    text,
  sort_order    integer DEFAULT 0,
  food_id       uuid REFERENCES foods(id),
  food_name     text NOT NULL,
  quantity_g    numeric(8,1),
  serving_qty   numeric(8,2),
  serving_label text,
  calc_kcal         numeric(8,1),
  calc_protein_g    numeric(8,1),
  calc_carbs_g      numeric(8,1),
  calc_fat_g        numeric(8,1),
  calc_fiber_g      numeric(8,1),
  preparation_notes text,
  substitution_note text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpi_plan ON meal_plan_items(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_mpi_food ON meal_plan_items(food_id);
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Meal plan items follow parent" ON meal_plan_items FOR ALL
    USING (meal_plan_id IN (SELECT id FROM meal_plans WHERE tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 3.4 MEAL_PLAN_ASSIGNMENTS — Vínculo cardápio ↔ paciente
CREATE TABLE IF NOT EXISTS meal_plan_assignments (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_plan_id  uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_date    date DEFAULT CURRENT_DATE,
  status        text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, meal_plan_id)
);

ALTER TABLE meal_plan_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users see own meal assignments" ON meal_plan_assignments FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage meal assignments" ON meal_plan_assignments FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ====================================================================
-- PARTE 4: SEED — 68 ALIMENTOS TACO/TBCA MAIS USADOS
-- Valores por 100g — fonte: TACO 4ª edição (NEPA/UNICAMP) + TBCA (USP)
-- ====================================================================

INSERT INTO foods (taco_id, name, name_search, category, source, energy_kcal, protein_g, total_fat_g, carbs_g, fiber_g, calcium_mg, iron_mg, sodium_mg, potassium_mg, vitamin_c_mg, serving_size_g, serving_label) VALUES
-- CEREAIS
(1, 'Arroz integral cozido', 'arroz integral cozido', 'Cereais', 'taco', 124, 2.6, 1.0, 25.8, 2.7, 5, 0.3, 1, 55, 0, 125, '1 escumadeira'),
(2, 'Arroz branco cozido', 'arroz branco cozido', 'Cereais', 'taco', 128, 2.5, 0.2, 28.1, 1.6, 4, 0.1, 1, 26, 0, 125, '1 escumadeira'),
(3, 'Aveia em flocos', 'aveia em flocos', 'Cereais', 'taco', 394, 13.9, 8.5, 66.6, 9.1, 48, 4.4, 3, 336, 0, 30, '3 colheres de sopa'),
(4, 'Batata-doce cozida', 'batata-doce cozida', 'Cereais', 'taco', 77, 0.6, 0.1, 18.4, 2.2, 17, 0.2, 6, 148, 12, 100, '1 unidade média'),
(5, 'Mandioca cozida', 'mandioca cozida', 'Cereais', 'taco', 125, 0.6, 0.3, 30.1, 1.6, 14, 0.2, 2, 69, 11, 100, '2 pedaços médios'),
(6, 'Pão francês', 'pao frances', 'Cereais', 'taco', 300, 8.0, 3.1, 58.6, 2.3, 22, 1.0, 648, 107, 0, 50, '1 unidade'),
(7, 'Pão integral', 'pao integral', 'Cereais', 'taco', 253, 9.4, 3.4, 49.9, 6.9, 64, 2.3, 467, 225, 0, 50, '2 fatias'),
(8, 'Macarrão cozido', 'macarrao cozido', 'Cereais', 'taco', 102, 3.4, 0.4, 19.9, 1.4, 7, 0.5, 1, 10, 0, 110, '1 pegador'),
(9, 'Quinoa cozida', 'quinoa cozida', 'Cereais', 'taco', 120, 4.4, 1.9, 21.3, 2.8, 17, 1.5, 7, 172, 0, 120, '4 colheres de sopa'),
(10, 'Tapioca (goma hidratada)', 'tapioca goma hidratada', 'Cereais', 'taco', 85, 0.0, 0.0, 21.0, 0.1, 5, 0.1, 0, 8, 0, 60, '1 unidade'),
(11, 'Milho verde cozido', 'milho verde cozido', 'Cereais', 'taco', 138, 6.6, 1.3, 28.6, 3.9, 3, 0.5, 1, 282, 5, 100, '1 espiga'),
(12, 'Cuscuz de milho cozido', 'cuscuz de milho cozido', 'Cereais', 'taco', 113, 2.6, 0.7, 23.2, 1.8, 12, 0.5, 1, 34, 0, 100, '1 fatia'),
-- VERDURAS E LEGUMES
(20, 'Abóbora moranga cozida', 'abobora moranga cozida', 'Verduras e Legumes', 'taco', 15, 0.6, 0.1, 3.4, 1.1, 7, 0.2, 1, 131, 3, 100, '2 fatias'),
(21, 'Abobrinha cozida', 'abobrinha cozida', 'Verduras e Legumes', 'taco', 15, 0.8, 0.1, 3.0, 1.0, 12, 0.3, 1, 135, 5, 100, '3 colheres de sopa'),
(22, 'Alface americana', 'alface americana', 'Verduras e Legumes', 'taco', 12, 1.3, 0.2, 1.7, 1.8, 19, 0.4, 6, 234, 4, 30, '3 folhas'),
(23, 'Berinjela cozida', 'berinjela cozida', 'Verduras e Legumes', 'taco', 19, 0.7, 0.1, 4.5, 2.5, 7, 0.2, 1, 106, 1, 100, '3 colheres de sopa'),
(24, 'Beterraba crua', 'beterraba crua', 'Verduras e Legumes', 'taco', 49, 1.9, 0.1, 11.1, 3.4, 18, 0.3, 59, 375, 3, 85, '3 fatias'),
(25, 'Brócolis cozido', 'brocolis cozido', 'Verduras e Legumes', 'taco', 25, 2.1, 0.5, 4.4, 3.4, 51, 0.5, 3, 118, 42, 80, '4 colheres de sopa'),
(26, 'Cenoura crua', 'cenoura crua', 'Verduras e Legumes', 'taco', 34, 1.3, 0.2, 7.7, 3.2, 23, 0.2, 3, 315, 3, 75, '1 unidade média'),
(27, 'Chuchu cozido', 'chuchu cozido', 'Verduras e Legumes', 'taco', 17, 0.4, 0.1, 3.8, 1.0, 11, 0.1, 1, 87, 7, 100, '3 colheres de sopa'),
(28, 'Couve refogada', 'couve refogada', 'Verduras e Legumes', 'taco', 90, 2.9, 7.3, 4.3, 4.2, 177, 0.5, 28, 182, 77, 50, '2 colheres de sopa'),
(29, 'Espinafre refogado', 'espinafre refogado', 'Verduras e Legumes', 'taco', 56, 2.0, 4.0, 4.2, 3.2, 103, 1.0, 33, 254, 5, 60, '3 colheres de sopa'),
(30, 'Pepino', 'pepino', 'Verduras e Legumes', 'taco', 10, 0.9, 0.0, 2.0, 1.1, 8, 0.2, 1, 140, 5, 80, '4 fatias'),
(31, 'Repolho cru', 'repolho cru', 'Verduras e Legumes', 'taco', 17, 0.9, 0.1, 3.9, 1.4, 35, 0.2, 7, 149, 35, 50, '2 colheres de sopa'),
(32, 'Rúcula', 'rucula', 'Verduras e Legumes', 'taco', 16, 2.0, 0.3, 2.2, 1.6, 117, 1.0, 7, 280, 6, 20, '1 xícara'),
(33, 'Tomate cru', 'tomate cru', 'Verduras e Legumes', 'taco', 15, 1.1, 0.2, 3.1, 1.2, 7, 0.2, 2, 222, 22, 80, '4 fatias'),
(34, 'Vagem cozida', 'vagem cozida', 'Verduras e Legumes', 'taco', 25, 1.6, 0.2, 5.4, 2.0, 42, 0.5, 1, 91, 5, 80, '4 colheres de sopa'),
-- FRUTAS
(50, 'Abacate', 'abacate', 'Frutas', 'taco', 96, 1.2, 8.4, 6.0, 6.3, 8, 0.2, 2, 206, 9, 100, '2 colheres de sopa'),
(51, 'Abacaxi', 'abacaxi', 'Frutas', 'taco', 48, 0.9, 0.1, 12.3, 1.0, 22, 0.3, 1, 131, 35, 100, '1 fatia média'),
(52, 'Banana prata', 'banana prata', 'Frutas', 'taco', 98, 1.3, 0.1, 26.0, 2.0, 8, 0.4, 0, 358, 22, 86, '1 unidade'),
(53, 'Laranja pera', 'laranja pera', 'Frutas', 'taco', 37, 1.0, 0.1, 8.9, 0.8, 22, 0.1, 1, 163, 53, 150, '1 unidade'),
(54, 'Limão', 'limao', 'Frutas', 'taco', 32, 0.9, 0.1, 11.1, 1.2, 51, 0.2, 1, 128, 38, 50, '1 unidade'),
(55, 'Maçã', 'maca', 'Frutas', 'taco', 56, 0.3, 0.0, 15.2, 1.3, 2, 0.1, 0, 75, 0, 130, '1 unidade'),
(56, 'Mamão papaia', 'mamao papaia', 'Frutas', 'taco', 40, 0.5, 0.1, 10.4, 1.0, 25, 0.2, 3, 222, 78, 150, '1/2 unidade'),
(57, 'Manga', 'manga', 'Frutas', 'taco', 51, 0.4, 0.2, 12.8, 1.6, 8, 0.1, 2, 138, 28, 140, '1 unidade pequena'),
(58, 'Melancia', 'melancia', 'Frutas', 'taco', 33, 0.9, 0.0, 8.1, 0.1, 8, 0.2, 0, 104, 6, 150, '1 fatia'),
(59, 'Morango', 'morango', 'Frutas', 'taco', 30, 0.9, 0.3, 6.8, 1.7, 11, 0.3, 1, 184, 64, 100, '6 unidades'),
(60, 'Uva itália', 'uva italia', 'Frutas', 'taco', 53, 0.7, 0.2, 13.6, 0.9, 7, 0.1, 1, 162, 1, 100, '10 bagos'),
(61, 'Goiaba vermelha', 'goiaba vermelha', 'Frutas', 'taco', 54, 1.1, 0.4, 13.0, 6.2, 4, 0.2, 3, 198, 80, 120, '1 unidade'),
(62, 'Kiwi', 'kiwi', 'Frutas', 'taco', 51, 1.3, 0.6, 11.5, 2.7, 26, 0.3, 4, 269, 71, 75, '1 unidade'),
-- CARNES E PEIXES
(80, 'Frango peito grelhado', 'frango peito grelhado', 'Carnes', 'taco', 159, 32.0, 2.5, 0.0, 0.0, 4, 0.3, 63, 300, 0, 100, '1 filé médio'),
(81, 'Frango coxa assada', 'frango coxa assada', 'Carnes', 'taco', 215, 26.2, 12.0, 0.0, 0.0, 12, 0.8, 74, 204, 0, 100, '1 coxa'),
(82, 'Carne bovina patinho grelhado', 'carne bovina patinho grelhado', 'Carnes', 'taco', 219, 35.9, 7.3, 0.0, 0.0, 4, 3.0, 56, 370, 0, 100, '1 bife médio'),
(83, 'Carne bovina acém cozido', 'carne bovina acem cozido', 'Carnes', 'taco', 212, 26.7, 11.2, 0.0, 0.0, 7, 2.7, 46, 186, 0, 100, '2 pedaços'),
(84, 'Carne moída refogada', 'carne moida refogada', 'Carnes', 'taco', 212, 26.3, 11.4, 0.0, 0.0, 8, 2.5, 53, 220, 0, 100, '4 colheres de sopa'),
(85, 'Carne suína lombo assado', 'carne suina lombo assado', 'Carnes', 'taco', 210, 30.2, 9.7, 0.0, 0.0, 8, 0.9, 60, 360, 0, 100, '1 fatia grossa'),
(86, 'Salmão grelhado', 'salmao grelhado', 'Carnes', 'taco', 243, 26.2, 14.5, 0.0, 0.0, 8, 0.4, 59, 363, 0, 100, '1 filé pequeno'),
(87, 'Tilápia grelhada', 'tilapia grelhada', 'Carnes', 'taco', 124, 26.0, 2.7, 0.0, 0.0, 10, 0.5, 50, 302, 0, 100, '1 filé'),
(88, 'Atum em conserva', 'atum em conserva', 'Carnes', 'taco', 166, 26.2, 6.4, 0.0, 0.0, 12, 1.0, 380, 207, 0, 60, '1 lata escorrida'),
(89, 'Sardinha em conserva', 'sardinha em conserva', 'Carnes', 'taco', 285, 15.9, 24.5, 0.0, 0.0, 550, 3.5, 585, 250, 0, 60, '1/2 lata'),
(90, 'Fígado bovino grelhado', 'figado bovino grelhado', 'Carnes', 'taco', 225, 29.4, 11.0, 3.6, 0.0, 7, 12.4, 101, 355, 24, 100, '1 bife fino'),
-- OVOS
(100, 'Ovo cozido', 'ovo cozido', 'Ovos', 'taco', 146, 13.3, 9.5, 0.6, 0.0, 49, 1.5, 146, 135, 0, 50, '1 unidade'),
(101, 'Ovo frito', 'ovo frito', 'Ovos', 'taco', 240, 15.6, 18.6, 1.2, 0.0, 55, 2.2, 347, 175, 0, 50, '1 unidade'),
(102, 'Clara de ovo', 'clara de ovo', 'Ovos', 'taco', 44, 9.3, 0.0, 1.0, 0.0, 6, 0.0, 163, 129, 0, 33, '1 unidade'),
-- LATICÍNIOS
(110, 'Leite integral', 'leite integral', 'Laticínios', 'taco', 58, 3.0, 3.0, 4.5, 0.0, 113, 0.1, 61, 140, 0, 200, '1 copo'),
(111, 'Leite desnatado', 'leite desnatado', 'Laticínios', 'taco', 35, 3.4, 0.2, 4.9, 0.0, 123, 0.1, 52, 156, 0, 200, '1 copo'),
(112, 'Iogurte natural integral', 'iogurte natural integral', 'Laticínios', 'taco', 51, 4.1, 1.6, 5.5, 0.0, 143, 0.1, 52, 170, 0, 170, '1 pote'),
(113, 'Iogurte natural desnatado', 'iogurte natural desnatado', 'Laticínios', 'taco', 42, 3.8, 0.3, 6.2, 0.0, 136, 0.1, 58, 195, 0, 170, '1 pote'),
(114, 'Queijo minas frescal', 'queijo minas frescal', 'Laticínios', 'taco', 264, 17.4, 20.2, 3.2, 0.0, 579, 0.3, 31, 76, 0, 30, '1 fatia'),
(115, 'Queijo cottage', 'queijo cottage', 'Laticínios', 'taco', 98, 11.5, 4.3, 3.4, 0.0, 60, 0.1, 380, 86, 0, 50, '2 colheres de sopa'),
(116, 'Queijo parmesão', 'queijo parmesao', 'Laticínios', 'taco', 453, 35.6, 33.5, 0.0, 0.0, 992, 0.8, 1602, 100, 0, 15, '1 colher de sopa'),
(117, 'Ricota', 'ricota', 'Laticínios', 'taco', 140, 12.6, 8.1, 3.8, 0.0, 253, 0.3, 102, 92, 0, 40, '1 fatia grossa'),
(118, 'Cream cheese', 'cream cheese', 'Laticínios', 'taco', 292, 6.2, 28.6, 3.0, 0.0, 80, 0.2, 296, 119, 0, 30, '1 colher de sopa'),
-- LEGUMINOSAS
(130, 'Feijão carioca cozido', 'feijao carioca cozido', 'Leguminosas', 'taco', 76, 4.8, 0.5, 13.6, 8.5, 27, 1.3, 2, 256, 0, 65, '1 concha'),
(131, 'Feijão preto cozido', 'feijao preto cozido', 'Leguminosas', 'taco', 77, 4.5, 0.5, 14.0, 8.4, 29, 1.5, 2, 280, 0, 65, '1 concha'),
(132, 'Lentilha cozida', 'lentilha cozida', 'Leguminosas', 'taco', 93, 6.3, 0.5, 16.3, 7.9, 16, 1.5, 2, 220, 0, 80, '3 colheres de sopa'),
(133, 'Grão-de-bico cozido', 'grao-de-bico cozido', 'Leguminosas', 'taco', 130, 6.7, 2.1, 21.2, 5.1, 40, 1.4, 5, 146, 0, 80, '3 colheres de sopa'),
(134, 'Ervilha cozida', 'ervilha cozida', 'Leguminosas', 'taco', 63, 4.1, 0.4, 10.6, 6.0, 17, 1.1, 1, 120, 5, 60, '2 colheres de sopa'),
(135, 'Soja cozida', 'soja cozida', 'Leguminosas', 'taco', 151, 14.0, 7.5, 8.5, 5.6, 83, 2.5, 1, 365, 0, 80, '3 colheres de sopa'),
-- OLEAGINOSAS E SEMENTES
(140, 'Castanha-do-pará', 'castanha-do-para', 'Oleaginosas', 'taco', 643, 14.5, 63.5, 15.1, 7.9, 146, 2.4, 2, 600, 1, 10, '2 unidades'),
(141, 'Castanha de caju', 'castanha de caju', 'Oleaginosas', 'taco', 570, 18.5, 46.3, 29.1, 3.7, 33, 5.0, 9, 565, 0, 15, '6 unidades'),
(142, 'Amendoim torrado', 'amendoim torrado', 'Oleaginosas', 'taco', 606, 27.2, 49.4, 20.3, 7.8, 43, 1.3, 5, 580, 0, 15, '1 colher de sopa'),
(143, 'Nozes', 'nozes', 'Oleaginosas', 'taco', 620, 14.0, 59.4, 18.4, 7.2, 105, 2.6, 2, 490, 1, 15, '3 unidades'),
(144, 'Semente de linhaça', 'semente de linhaca', 'Oleaginosas', 'taco', 495, 14.1, 32.3, 43.3, 33.5, 211, 4.7, 27, 869, 0, 10, '1 colher de sopa'),
(145, 'Semente de chia', 'semente de chia', 'Oleaginosas', 'tbca', 486, 16.5, 30.7, 42.1, 34.4, 631, 7.7, 16, 407, 0, 12, '1 colher de sopa'),
(146, 'Pasta de amendoim integral', 'pasta de amendoim integral', 'Oleaginosas', 'tbca', 593, 25.1, 49.2, 21.6, 8.0, 45, 1.7, 6, 649, 0, 15, '1 colher de sopa'),
-- ÓLEOS E GORDURAS
(150, 'Azeite de oliva', 'azeite de oliva', 'Óleos', 'taco', 884, 0.0, 100.0, 0.0, 0.0, 0, 0.0, 0, 0, 0, 8, '1 colher de sopa'),
(151, 'Óleo de coco', 'oleo de coco', 'Óleos', 'tbca', 862, 0.0, 99.1, 0.0, 0.0, 0, 0.0, 0, 0, 0, 8, '1 colher de sopa'),
(152, 'Manteiga', 'manteiga', 'Óleos', 'taco', 726, 0.4, 82.4, 0.0, 0.0, 5, 0.0, 6, 12, 0, 10, '1 colher de chá'),
-- OUTROS
(160, 'Mel', 'mel', 'Outros', 'taco', 309, 0.3, 0.0, 84.0, 0.0, 5, 0.3, 6, 50, 1, 21, '1 colher de sopa'),
(161, 'Açúcar mascavo', 'acucar mascavo', 'Outros', 'taco', 369, 0.6, 0.0, 94.2, 0.0, 127, 4.2, 33, 395, 0, 5, '1 colher de chá'),
(162, 'Farinha de mandioca', 'farinha de mandioca', 'Outros', 'taco', 365, 1.2, 0.3, 89.2, 6.5, 36, 0.9, 0, 92, 0, 15, '1 colher de sopa'),
(163, 'Granola', 'granola', 'Outros', 'tbca', 421, 10.0, 12.7, 71.8, 7.5, 52, 3.2, 14, 392, 0, 30, '3 colheres de sopa'),
(164, 'Whey protein (concentrado)', 'whey protein concentrado', 'Outros', 'tbca', 380, 75.0, 5.0, 10.0, 0.0, 400, 0.5, 200, 500, 0, 30, '1 scoop'),
(165, 'Cúrcuma em pó', 'curcuma em po', 'Outros', 'tbca', 354, 7.8, 9.9, 64.9, 21.1, 183, 41.4, 38, 2525, 26, 3, '1 colher de chá'),
(166, 'Gengibre', 'gengibre', 'Outros', 'taco', 46, 1.3, 0.3, 10.1, 0.8, 8, 0.3, 6, 415, 3, 5, '1 rodela'),
(167, 'Cacau em pó', 'cacau em po', 'Outros', 'tbca', 228, 19.6, 13.7, 57.9, 33.2, 128, 13.9, 21, 1524, 0, 10, '1 colher de sopa'),
(168, 'Coco ralado', 'coco ralado', 'Outros', 'taco', 592, 5.7, 56.0, 26.0, 15.0, 14, 1.8, 22, 324, 1, 15, '1 colher de sopa')
ON CONFLICT (name, source) DO NOTHING;


-- ====================================================================
-- PARTE 5: COMENTÁRIOS
-- ====================================================================

COMMENT ON TABLE agent_logs IS 'Log de execução de todos os agentes IA — debug, métricas e billing';
COMMENT ON TABLE inbox_messages IS 'Mensagens enviadas pelos agentes para as pacientes — inbox unificado com Realtime';
COMMENT ON TABLE patient_risk_scores IS 'Score de risco diário calculado pelo Sabotage Detection Agent';
COMMENT ON TABLE foods IS 'Base de alimentos brasileiros — TACO 4ª edição (NEPA/UNICAMP) + TBCA (USP). Valores por 100g.';
COMMENT ON TABLE meal_plans IS 'Cardápios criados pela nutricionista — gerados por IA e editáveis manualmente.';
COMMENT ON TABLE meal_plan_items IS 'Itens de cada refeição com vínculo para tabela de alimentos reais e valores nutricionais calculados.';
COMMENT ON TABLE meal_plan_assignments IS 'Vínculo cardápio ↔ paciente com data de início e status.';


-- ====================================================================
-- PARTE 6: pg_cron — AGENDAMENTO DIÁRIO DOS AGENTES
-- ⚠️  TROQUE "SEU_CRON_SECRET" pelo secret que você configurar
-- ⚠️  Rode isto SEPARADAMENTE se der erro (pg_cron pode não estar habilitado)
-- ====================================================================

-- Descomente as 2 linhas abaixo após habilitar pg_cron e pg_net no Dashboard:
-- SELECT cron.schedule('daily-agents', '0 12 * * *',
--   $$SELECT net.http_post(url := 'https://antszuxeairmbctwuafo.supabase.co/functions/v1/agent-orchestrator', headers := '{"x-cron-secret":"SEU_CRON_SECRET"}'::jsonb, body := '{"type":"cron_daily"}'::jsonb)$$);


-- ====================================================================
-- ✅ PRONTO! Verifique se rodou sem erros.
-- Próximos passos no terminal:
--   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
--   supabase functions deploy agent-orchestrator
-- ====================================================================
