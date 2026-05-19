-- ============================================================
-- Migration: Premium Architecture
-- Adds: meal_plans_v2, meal_items, substitutable_foods,
--       user_alarms, patient_journey_stages, ai_feedback_vectors
-- Also: profile edit trigger, agent_feedback_loop RPC
-- NOTE: challenges and challenge_participants are replaced by the missions system
-- ============================================================

-- Drop legacy tables (replaced by missions/journeys system)
DROP TABLE IF EXISTS challenge_participants CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;

-- ─── 1. meal_plans (premium data model) ──────────────────────────────────────
-- Note: meal_plans table may already exist from 20260321_foods_meal_plans.sql
-- This adds the premium fields and status flow if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meal_plans') THEN
    CREATE TABLE meal_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      plan_tier TEXT NOT NULL DEFAULT 'basic', -- 'basic' | 'premium' | 'vip'
      title TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      total_calories INTEGER,
      total_protein_g DECIMAL(8,2),
      total_carbs_g DECIMAL(8,2),
      total_fat_g DECIMAL(8,2),
      status TEXT NOT NULL DEFAULT 'pending_approval', -- 'pending_approval' | 'approved' | 'active' | 'completed'
      approved_by UUID REFERENCES auth.users(id),
      approved_at TIMESTAMPTZ,
      created_by_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    -- Add premium columns if they don't exist
    ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'basic';
    ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
    ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
    ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS created_by_agent TEXT;
  END IF;
END $$;

-- ─── 2. meal_items (detailed nutritional items) ───────────────────────────────
CREATE TABLE IF NOT EXISTS meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  meal_type TEXT NOT NULL, -- 'cafe_manha' | 'lanche_manha' | 'almoco' | 'lanche_tarde' | 'jantar' | 'ceia'
  food_name TEXT NOT NULL,
  quantity_g DECIMAL(8,2),
  quantity_description TEXT, -- '1 xícara', '2 fatias'
  calories DECIMAL(8,2),
  protein_g DECIMAL(8,2),
  carbs_g DECIMAL(8,2),
  fat_g DECIMAL(8,2),
  fiber_g DECIMAL(8,2),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. substitutable_foods ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS substitutable_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  original_food TEXT NOT NULL,
  substitute_food TEXT NOT NULL,
  original_calories DECIMAL(8,2),
  substitute_calories DECIMAL(8,2),
  caloric_difference_pct DECIMAL(5,2),
  protein_preserved BOOLEAN DEFAULT true,
  category TEXT, -- 'proteina' | 'carboidrato' | 'gordura' | 'vegetal' | 'fruta'
  restriction_tags TEXT[], -- ['lactose_free', 'gluten_free', 'vegan', 'vegetarian']
  is_global BOOLEAN DEFAULT false, -- global = available to all tenants
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. user_alarms ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alarm_type TEXT NOT NULL, -- 'hydration' | 'meal' | 'medication' | 'exercise' | 'checkin'
  label TEXT NOT NULL,
  time_hhmm TEXT NOT NULL, -- '08:00', '14:30'
  days_of_week INTEGER[] DEFAULT '{1,2,3,4,5,6,7}', -- 1=Mon...7=Sun
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. patient_journey_stages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_journey_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'awareness',
  -- 'awareness' | 'problem_aware' | 'solution_aware' | 'value_anchored' | 'upsell_ready' | 'converted'
  previous_stage TEXT,
  stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
  upsell_offer TEXT, -- 'genetic_map' | 'presential_checkup' | 'protocol_reprogramming' | 'annual_plan'
  upsell_offered_at TIMESTAMPTZ,
  upsell_approved_by_admin BOOLEAN DEFAULT false,
  upsell_converted BOOLEAN DEFAULT false,
  upsell_converted_at TIMESTAMPTZ,
  trigger_reason TEXT, -- what caused the stage change
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id) -- one active journey per patient
);

-- ─── 6. ai_feedback_vectors (RAG learning loop) ───────────────────────────────
CREATE TABLE IF NOT EXISTS ai_feedback_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pending_action_id UUID, -- reference to agent_pending_actions if applicable
  agent_type TEXT NOT NULL,
  original_content TEXT NOT NULL,
  approved_content TEXT NOT NULL,
  delta_summary TEXT, -- human-readable summary of what changed
  embedding_tags TEXT[], -- semantic tags for retrieval
  context_patient_profile JSONB DEFAULT '{}',
  admin_edit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitutable_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_journey_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback_vectors ENABLE ROW LEVEL SECURITY;

-- meal_plans: tenant owner + the patient
CREATE POLICY "meal_plans_tenant_owner" ON meal_plans FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "meal_plans_patient_read" ON meal_plans FOR SELECT
  USING (patient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- meal_items: through meal_plans
CREATE POLICY "meal_items_via_plan" ON meal_items FOR ALL
  USING (meal_plan_id IN (
    SELECT id FROM meal_plans
    WHERE tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  ));

CREATE POLICY "meal_items_patient_read" ON meal_items FOR SELECT
  USING (meal_plan_id IN (
    SELECT mp.id FROM meal_plans mp
    JOIN profiles p ON p.id = mp.patient_id
    WHERE p.user_id = auth.uid()
  ));

-- substitutable_foods: global or tenant-owned
CREATE POLICY "substitutable_foods_read" ON substitutable_foods FOR SELECT
  USING (is_global = true OR tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "substitutable_foods_write" ON substitutable_foods FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- user_alarms
CREATE POLICY "user_alarms_tenant_owner" ON user_alarms FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "user_alarms_patient_own" ON user_alarms FOR ALL
  USING (patient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- patient_journey_stages
CREATE POLICY "journey_stages_tenant_owner" ON patient_journey_stages FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- ai_feedback_vectors
CREATE POLICY "ai_feedback_tenant_owner" ON ai_feedback_vectors FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_meal_plans_tenant ON meal_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_patient ON meal_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_status ON meal_plans(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_meal_items_plan ON meal_items(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_meal_items_day ON meal_items(meal_plan_id, day_number);
CREATE INDEX IF NOT EXISTS idx_substitutable_foods_global ON substitutable_foods(is_global, category);
CREATE INDEX IF NOT EXISTS idx_substitutable_foods_tenant ON substitutable_foods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_alarms_patient ON user_alarms(patient_id);
CREATE INDEX IF NOT EXISTS idx_user_alarms_tenant ON user_alarms(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_journey_stages_tenant ON patient_journey_stages(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_journey_stages_patient ON patient_journey_stages(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_tenant ON ai_feedback_vectors(tenant_id, agent_type);

-- ─── Trigger: invalidate meal plans on profile clinical edit ─────────────────
CREATE OR REPLACE FUNCTION notify_profile_manual_edit()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if relevant clinical fields changed
  IF (OLD.dietary_restrictions IS DISTINCT FROM NEW.dietary_restrictions OR
      OLD.primary_goal IS DISTINCT FROM NEW.primary_goal OR
      OLD.current_weight IS DISTINCT FROM NEW.current_weight OR
      OLD.current_plan IS DISTINCT FROM NEW.current_plan) THEN
    -- Update any active meal_plans for this patient to require re-approval
    UPDATE meal_plans
    SET status = 'pending_approval',
        updated_at = NOW()
    WHERE patient_id = NEW.id
    AND status = 'active';

    -- Insert a sentinel record so orchestrator knows to recalculate
    INSERT INTO ai_feedback_vectors (
      tenant_id, agent_type, original_content, approved_content,
      delta_summary, context_patient_profile
    ) VALUES (
      NEW.tenant_id,
      'profile_override',
      'admin_manual_edit',
      'recalculate_required',
      'Admin edited clinical fields - protocols invalidated',
      jsonb_build_object('patient_id', NEW.id, 'changed_at', NOW())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_clinical_edit ON profiles;
CREATE TRIGGER on_profile_clinical_edit
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_profile_manual_edit();

-- ─── RPC: record_agent_feedback ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_agent_feedback(
  p_tenant_id UUID,
  p_pending_action_id UUID,
  p_agent_type TEXT,
  p_original_content TEXT,
  p_approved_content TEXT,
  p_patient_profile JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_delta TEXT;
BEGIN
  -- Simple delta summary
  IF p_original_content = p_approved_content THEN
    v_delta := 'approved_unchanged';
  ELSE
    v_delta := 'admin_edited_before_approval';
  END IF;

  INSERT INTO ai_feedback_vectors (
    tenant_id, pending_action_id, agent_type,
    original_content, approved_content, delta_summary,
    context_patient_profile
  ) VALUES (
    p_tenant_id, p_pending_action_id, p_agent_type,
    p_original_content, p_approved_content, v_delta,
    p_patient_profile
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Seed: global substitutable foods ────────────────────────────────────────
INSERT INTO substitutable_foods (original_food, substitute_food, original_calories, substitute_calories, caloric_difference_pct, category, is_global)
VALUES
  ('Arroz branco', 'Arroz integral', 130, 111, -14.6, 'carboidrato', true),
  ('Arroz branco', 'Quinoa', 130, 120, -7.7, 'carboidrato', true),
  ('Pão francês', 'Pão de forma integral', 150, 66, -56.0, 'carboidrato', true),
  ('Leite integral', 'Leite desnatado', 61, 35, -42.6, 'gordura', true),
  ('Frango frito', 'Frango grelhado', 246, 165, -32.9, 'proteina', true),
  ('Carne bovina (patinho)', 'Peito de peru', 219, 109, -50.2, 'proteina', true),
  ('Macarrão comum', 'Macarrão integral', 131, 124, -5.3, 'carboidrato', true),
  ('Açúcar refinado', 'Mel', 387, 304, -21.4, 'carboidrato', true),
  ('Manteiga', 'Azeite de oliva', 717, 884, 23.3, 'gordura', true),
  ('Batata frita', 'Batata-doce assada', 312, 86, -72.4, 'carboidrato', true)
ON CONFLICT DO NOTHING;
