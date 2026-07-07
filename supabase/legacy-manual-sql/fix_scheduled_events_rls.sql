-- ============================================
-- FIX: RLS Policies for Scheduled Events
-- ============================================

-- 1. Melhorar políticas da tabela scheduled_events
-- Permite que o usuário crie/veja eventos se ele estiver vinculado ao tenant no perfil dele
DROP POLICY IF EXISTS "Admins view tenant scheduled events" ON scheduled_events;
DROP POLICY IF EXISTS "Admins create tenant scheduled events" ON scheduled_events;
DROP POLICY IF EXISTS "Admins update tenant scheduled events" ON scheduled_events;
DROP POLICY IF EXISTS "Admins delete tenant scheduled events" ON scheduled_events;

CREATE POLICY "Users view tenant scheduled events"
  ON scheduled_events FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users create tenant scheduled events"
  ON scheduled_events FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users update tenant scheduled events"
  ON scheduled_events FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users delete tenant scheduled events"
  ON scheduled_events FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- 2. Melhorar políticas da tabela content_templates
DROP POLICY IF EXISTS "Admins view tenant templates" ON content_templates;
DROP POLICY IF EXISTS "Admins create tenant templates" ON content_templates;
DROP POLICY IF EXISTS "Admins update tenant templates" ON content_templates;
DROP POLICY IF EXISTS "Admins delete tenant templates" ON content_templates;

CREATE POLICY "Users view tenant templates"
  ON content_templates FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL OR 
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users create tenant templates"
  ON content_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users update tenant templates"
  ON content_templates FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users delete tenant templates"
  ON content_templates FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );
