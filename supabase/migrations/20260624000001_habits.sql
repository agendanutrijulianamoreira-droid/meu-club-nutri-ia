-- ============================================
-- Módulo de Hábitos (inspirado no MyDose)
-- habits + habit_logs
-- ============================================

CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '✅',
    description TEXT,
    category TEXT DEFAULT 'saude'
        CHECK (category IN ('saude', 'alimentacao', 'movimento', 'mente', 'social', 'outro')),
    icon_color TEXT DEFAULT 'indigo',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orientações gerais dos hábitos (texto exibido às pacientes)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS habits_orientation TEXT;

-- Logs diários de conclusão de hábitos pelas pacientes
CREATE TABLE IF NOT EXISTS habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    habit_id UUID REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    hit_type TEXT NOT NULL DEFAULT 'simple'
        CHECK (hit_type IN ('simple', 'camera', 'gallery')),
    photo_url TEXT,
    notes TEXT,
    xp_awarded INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, habit_id, log_date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_habits_tenant ON habits(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_tenant_date ON habit_logs(tenant_id, log_date);

-- RLS
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

-- Admins/nutricionistas gerenciam hábitos do seu tenant
CREATE POLICY "habits_admin_all" ON habits
    FOR ALL USING (
        tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
    );

-- Pacientes leem hábitos do seu tenant
CREATE POLICY "habits_patient_read" ON habits
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Pacientes gerenciam seus próprios logs
CREATE POLICY "habit_logs_patient_all" ON habit_logs
    FOR ALL USING (user_id = auth.uid());

-- Admins leem logs do seu tenant
CREATE POLICY "habit_logs_admin_read" ON habit_logs
    FOR SELECT USING (
        tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
    );
