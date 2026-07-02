-- ============================================
-- SCHEDULED EVENTS - Estratégia Mensal
-- ============================================
-- NOTA (2026-07-02): scheduled_events e content_templates estão
-- ativas em produção e não têm nenhuma migration numerada
-- equivalente em /supabase/migrations. Este arquivo é hoje a única
-- documentação de como recriá-las do zero.
-- Ver supabase/legacy-manual-sql/README.md.
-- ============================================

-- Tabela de eventos agendados (push, conteúdo, desafios)
CREATE TABLE IF NOT EXISTS scheduled_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Relação
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  -- Agendamento
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL DEFAULT '09:00',
  
  -- Tipo e Conteúdo
  event_type TEXT NOT NULL CHECK (event_type IN ('push', 'content', 'challenge')),
  title TEXT NOT NULL,
  message TEXT,
  content_type TEXT CHECK (content_type IN ('diet', 'recipe', 'video', 'pdf', 'shot', 'article')),
  
  -- Referência a conteúdo existente (opcional)
  protocol_id UUID REFERENCES protocols(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'cancelled')),
  sent_at TIMESTAMPTZ,
  
  -- Metadata adicional (JSON flexível)
  metadata JSONB DEFAULT '{}',

  -- ID de grupo para recorrência
  recurrence_id UUID
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_scheduled_events_tenant ON scheduled_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_date ON scheduled_events(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_status ON scheduled_events(status) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_scheduled_events_tenant_date ON scheduled_events(tenant_id, scheduled_date);

-- Trigger para atualizar updated_at
CREATE TRIGGER scheduled_events_updated_at 
  BEFORE UPDATE ON scheduled_events
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE scheduled_events ENABLE ROW LEVEL SECURITY;

-- Admin pode ver todos eventos do seu tenant
CREATE POLICY "Users view tenant scheduled events"
  ON scheduled_events FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin pode criar eventos para seu tenant
CREATE POLICY "Users create tenant scheduled events"
  ON scheduled_events FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin pode atualizar eventos do seu tenant
CREATE POLICY "Users update tenant scheduled events"
  ON scheduled_events FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin pode deletar eventos do seu tenant
CREATE POLICY "Users delete tenant scheduled events"
  ON scheduled_events FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- CONTENT TEMPLATES - Templates Rápidos
-- ============================================

CREATE TABLE IF NOT EXISTS content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Relação (null = template global, disponível para todos)
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Template
  name TEXT NOT NULL, -- Ex: "Lembrete de Água", "Check-in Semanal"
  category TEXT NOT NULL CHECK (category IN ('reminders', 'check-ins', 'motivational', 'content', 'challenges')),
  event_type TEXT NOT NULL CHECK (event_type IN ('push', 'content', 'challenge')),
  title TEXT NOT NULL,
  message TEXT,
  content_type TEXT CHECK (content_type IN ('diet', 'recipe', 'video', 'pdf', 'shot', 'article')),
  suggested_time TIME DEFAULT '09:00',
  
  -- Uso e favoritos
  usage_count INTEGER DEFAULT 0,
  is_favorite BOOLEAN DEFAULT false,
  
  -- Ícone/emoji para UI
  emoji TEXT DEFAULT '📌'
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_content_templates_tenant ON content_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_category ON content_templates(category);
CREATE INDEX IF NOT EXISTS idx_content_templates_favorites ON content_templates(is_favorite) WHERE is_favorite = true;

-- ============================================
-- RLS POLICIES - TEMPLATES
-- ============================================

ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;

-- Todos podem ver e usar templates globais (incrementa usage_count)
CREATE POLICY "Everyone sees and uses global templates"
  ON content_templates FOR SELECT
  TO authenticated
  USING (tenant_id IS NULL);

CREATE POLICY "Everyone can increment global templates usage"
  ON content_templates FOR UPDATE
  TO authenticated
  USING (tenant_id IS NULL)
  WITH CHECK (tenant_id IS NULL);

-- Admin vê templates do seu tenant
CREATE POLICY "Users view tenant templates"
  ON content_templates FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin pode criar templates para seu tenant
CREATE POLICY "Users create tenant templates"
  ON content_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin pode atualizar templates do seu tenant
CREATE POLICY "Users update tenant templates"
  ON content_templates FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin pode deletar templates do seu tenant
CREATE POLICY "Users delete tenant templates"
  ON content_templates FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- SEED - TEMPLATES GLOBAIS
-- ============================================

-- Templates globais (disponíveis para todos os tenants)
INSERT INTO content_templates (tenant_id, name, category, event_type, title, message, suggested_time, emoji)
VALUES
  -- Lembretes
  (NULL, 'Lembrete de Água', 'reminders', 'push', '💧 Hora de Hidratar!', 'Já bebeu seus 2L de água hoje? Manter-se hidratada é fundamental! 💦', '10:00', '💧'),
  (NULL, 'Lembrete de Refeição', 'reminders', 'push', '🍽️ Hora da Refeição!', 'Não pule refeições! Seu corpo precisa de energia. ❤️', '12:00', '🍽️'),
  (NULL, 'Lembrete Noturno', 'reminders', 'push', '😴 Hora de Descansar', 'Um bom sono é essencial para seus resultados. Vá dormir! 🌙', '22:00', '😴'),
  
  -- Check-ins
  (NULL, 'Check-in Semanal', 'check-ins', 'push', '📸 Check-in Semanal!', 'Hora de registrar seu progresso! Tire uma foto e compartilhe sua evolução. 📷✨', '09:00', '📸'),
  (NULL, 'Check-in de Peso', 'check-ins', 'push', '⚖️ Pesagem da Semana', 'Hora de subir na balança! Lembre-se: o peso é só um número, não define você. 💪', '07:00', '⚖️'),
  
  -- Motivacionais
  (NULL, 'Motivação Diária', 'motivational', 'push', '✨ Você é Incrível!', 'Cada dia é uma nova oportunidade de cuidar de você. Continue firme! 💪', '08:00', '✨'),
  (NULL, 'Parabéns por Consistência', 'motivational', 'push', '🎉 Parabéns!', 'Você está arrasando! Sua dedicação vai trazer resultados incríveis! 🔥', '18:00', '🎉'),
  (NULL, 'Foco no Objetivo', 'motivational', 'push', '🎯 Foco Total!', 'Lembre-se do seu objetivo! Você está mais perto do que imagina. 🚀', '15:00', '🎯'),
  
  -- Desafios
  (NULL, 'Desafio: Foto do Prato', 'challenges', 'challenge', '📷 Desafio: Foto do Almoço', 'Tire uma foto do seu prato hoje! Compartilhe e ganhe pontos extras! 🍽️✨', '12:00', '📷'),
  (NULL, 'Desafio: Passos do Dia', 'challenges', 'challenge', '👟 Desafio: 10mil Passos', 'Meta de hoje: 10 mil passos! Você consegue! 🚶‍♀️💪', '16:00', '👟')
ON CONFLICT DO NOTHING;

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE scheduled_events IS 'Eventos agendados para estratégia mensal (push, conteúdo, desafios)';
COMMENT ON TABLE content_templates IS 'Templates rápidos para agilizar criação de eventos';
COMMENT ON COLUMN scheduled_events.status IS 'scheduled = agendado, sent = enviado, cancelled = cancelado';
COMMENT ON COLUMN content_templates.tenant_id IS 'NULL = template global disponível para todos';
