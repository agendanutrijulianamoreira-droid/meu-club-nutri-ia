-- ============================================
-- FIX: RLS Policies for Content Templates
-- ============================================

-- 1. Tornar templates globais atualizáveis (pelo menos o contador de uso)
-- Nota: Por simplicidade em desenvolvimento, vamos permitir UPDATE em templates globais
DROP POLICY IF EXISTS "Everyone sees global templates" ON content_templates;
CREATE POLICY "Everyone sees and uses global templates"
  ON content_templates FOR SELECT
  TO authenticated
  USING (tenant_id IS NULL);

CREATE POLICY "Everyone can increment global templates usage"
  ON content_templates FOR UPDATE
  TO authenticated
  USING (tenant_id IS NULL)
  WITH CHECK (tenant_id IS NULL);

-- 2. Atualizar políticas de templates de tenant para serem flexíveis (baseadas no perfil)
DROP POLICY IF EXISTS "Admins view tenant templates" ON content_templates;
DROP POLICY IF EXISTS "Admins create tenant templates" ON content_templates;
DROP POLICY IF EXISTS "Admins update tenant templates" ON content_templates;
DROP POLICY IF EXISTS "Admins delete tenant templates" ON content_templates;

CREATE POLICY "Users view tenant templates"
  ON content_templates FOR SELECT
  TO authenticated
  USING (
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

-- 3. Caso o erro persista ao salvar o evento APÓS aplicar o template,
-- garanta que as políticas de scheduled_events também foram aplicadas conforme o passo anterior.
