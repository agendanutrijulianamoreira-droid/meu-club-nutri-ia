-- ============================================================
-- Arquitetura "Método Clínico" — Sub-fase 3: Protocolos, PR1
-- Fundação de schema (100% aditiva) para protocol_items passar
-- a referenciar a Biblioteca Clínica (recipe/meal/shot/tea/
-- supplement/material) em vez de texto livre, mais protocol_goals
-- como única ligação de Metas a um protocolo inteiro.
--
-- Especificação completa: docs/architecture/sub-fase-3-protocolos.md
-- (Seções 2.1 a 2.8 e 9 — este arquivo segue a ordem de operações
-- da Seção 2.8 exatamente, incluindo a correção do bug de
-- item_kind DEFAULT e o backfill seguro de tenant_id).
--
-- Nada é removido nesta PR: protocol_items.type/.ingredients/.recipe
-- e protocols.content continuam existindo e em uso até o PR4.
-- 2026-07-22
-- ============================================================

-- ------------------------------------------------------------
-- 0. Limpeza pré-backfill (Seção 2.8, item 4) — remove linhas de
--    protocol_items que já são órfãs hoje (protocol_day_id não
--    corresponde a nenhum protocol_days.id existente). Sem isso,
--    o backfill de tenant_id não alcança essas linhas e o
--    SET NOT NULL subsequente falharia. Estas linhas não aparecem
--    em nenhuma tela hoje (não há protocol_days válido para
--    alcançá-las a partir de nenhum protocolo real).
-- ------------------------------------------------------------

DELETE FROM protocol_items WHERE protocol_day_id NOT IN (SELECT id FROM protocol_days);

-- ------------------------------------------------------------
-- 1. protocol_days — tenant_id denormalizado (Seção 2.2/2.7)
-- ------------------------------------------------------------

ALTER TABLE protocol_days ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE protocol_days pd
SET tenant_id = p.tenant_id
FROM protocols p
WHERE p.id = pd.protocol_id
  AND pd.tenant_id IS NULL;

ALTER TABLE protocol_days ALTER COLUMN tenant_id SET NOT NULL;

-- ------------------------------------------------------------
-- 2. protocol_items — tenant_id denormalizado (Seção 2.3/2.7)
-- ------------------------------------------------------------

ALTER TABLE protocol_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE protocol_items pi
SET tenant_id = pd.tenant_id
FROM protocol_days pd
WHERE pd.id = pi.protocol_day_id
  AND pi.tenant_id IS NULL;

ALTER TABLE protocol_items ALTER COLUMN tenant_id SET NOT NULL;

-- ------------------------------------------------------------
-- 3. protocol_items — item_kind + 6 FKs nullable à Biblioteca
--    Clínica (Seção 2.3). DEFAULT 'custom' é deliberado — é o
--    único valor compatível com qualquer linha legada (0 das 6
--    FKs novas preenchidas). A aplicação (PR2) sempre grava
--    item_kind explicitamente ao criar um item novo.
-- ------------------------------------------------------------

ALTER TABLE protocol_items
  ADD COLUMN IF NOT EXISTS item_kind text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES recipes(id),
  ADD COLUMN IF NOT EXISTS meal_id uuid REFERENCES meals(id),
  ADD COLUMN IF NOT EXISTS shot_id uuid REFERENCES shots(id),
  ADD COLUMN IF NOT EXISTS tea_id uuid REFERENCES teas(id),
  ADD COLUMN IF NOT EXISTS supplement_id uuid REFERENCES supplements(id),
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES materials(id),
  ADD COLUMN IF NOT EXISTS quantity numeric,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS serving_label text;

-- CHECK forte (Seção 2.3): item_kind e a contagem de FKs preenchidas
-- precisam concordar entre si. Adicionado só depois do backfill acima
-- para não conflitar com a ordem de operações da Seção 2.8. Postgres
-- valida todas as linhas existentes ao rodar este ALTER — se alguma
-- linha violar a regra, a migração inteira falha aqui em vez de
-- silenciosamente aceitar dado inconsistente.
ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_kind_check;
ALTER TABLE protocol_items ADD CONSTRAINT protocol_items_kind_check CHECK (
  (item_kind = 'custom'         AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 0)
  OR
  (item_kind = 'clinical_asset' AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 1)
);

-- ------------------------------------------------------------
-- 4. protocol_days — UNIQUE(protocol_id, day_number) (Seção 2.2)
-- ------------------------------------------------------------

ALTER TABLE protocol_days DROP CONSTRAINT IF EXISTS protocol_days_protocol_id_day_number_key;
ALTER TABLE protocol_days ADD CONSTRAINT protocol_days_protocol_id_day_number_key UNIQUE (protocol_id, day_number);

-- ------------------------------------------------------------
-- 5. protocol_progress — FK real + UNIQUE (Seção 2.5)
--    Guardado via checagem em pg_constraint (em vez de DROP+ADD
--    direto): o schema de bootstrap original (schema_extended.sql)
--    já declarava UNIQUE(assignment_id, protocol_item_id) na
--    criação da tabela, então o nome real do constraint em produção
--    pode não ser o mesmo que usaríamos aqui — evita duplicar um
--    constraint equivalente sob outro nome.
-- ------------------------------------------------------------

ALTER TABLE protocol_progress DROP CONSTRAINT IF EXISTS protocol_progress_protocol_item_id_fkey;
ALTER TABLE protocol_progress
  ADD CONSTRAINT protocol_progress_protocol_item_id_fkey
  FOREIGN KEY (protocol_item_id) REFERENCES protocol_items(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'protocol_progress'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(assignment_id, protocol_item_id)%'
  ) THEN
    ALTER TABLE protocol_progress
      ADD CONSTRAINT protocol_progress_assignment_item_unique
      UNIQUE (assignment_id, protocol_item_id);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. protocols — method_phase_id nullable (Seção 2.1/7 —
--    evita rework na Sub-fase 6, mesmo raciocínio já usado para
--    campos de IA nullable na Sub-fase 2)
-- ------------------------------------------------------------

ALTER TABLE protocols ADD COLUMN IF NOT EXISTS method_phase_id uuid REFERENCES method_phases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_protocols_method_phase ON protocols(method_phase_id);

-- ------------------------------------------------------------
-- 7. protocol_goals — única tabela de junção nova desta sub-fase
--    (Seção 2.4). Metas só se ligam a um protocolo inteiro aqui —
--    nunca em protocol_items.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS protocol_goals (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id uuid NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  goal_id     uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (protocol_id, goal_id)
);

CREATE INDEX IF NOT EXISTS idx_protocol_goals_protocol ON protocol_goals(protocol_id);
CREATE INDEX IF NOT EXISTS idx_protocol_goals_goal ON protocol_goals(goal_id);
CREATE INDEX IF NOT EXISTS idx_protocol_goals_tenant ON protocol_goals(tenant_id);

ALTER TABLE protocol_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read protocol_goals"
  ON protocol_goals FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_goals.tenant_id));

CREATE POLICY "Admin manages own protocol_goals"
  ON protocol_goals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_goals.tenant_id AND profiles.role IN ('admin','nutritionist')));

-- ------------------------------------------------------------
-- 8. RLS de protocol_days/protocol_items — reescrita obrigatória
--    (Seção 2.6 / Achado 0.2). A política atual permite qualquer
--    paciente autenticada de qualquer tenant ler conteúdo de
--    protocolo de outro tenant, e não tem NENHUMA política de
--    escrita — todo INSERT como usuário de sessão (não service
--    role) é negado por padrão pelo Postgres. Isso é a causa raiz
--    de app/api/admin/seasonal-protocols/route.ts salvar o
--    protocolo mas nunca salvar dias/itens.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "authenticated_read_protocol_days" ON protocol_days;
DROP POLICY IF EXISTS "authenticated_read_protocol_items" ON protocol_items;

CREATE POLICY "Tenant patients can read active protocol content days"
  ON protocol_days FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_days.tenant_id));

CREATE POLICY "Admin manages own protocol_days"
  ON protocol_days FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_days.tenant_id AND profiles.role IN ('admin','nutritionist')));

CREATE POLICY "Tenant patients can read active protocol content items"
  ON protocol_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_items.tenant_id));

CREATE POLICY "Admin manages own protocol_items"
  ON protocol_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_items.tenant_id AND profiles.role IN ('admin','nutritionist')));

-- ------------------------------------------------------------
-- 9. Índices de leitura (Seção 2.3) — a consulta mais frequente
--    do sistema ("traga o dia de hoje, ordenado") e os 6 índices
--    parciais por FK, necessários para o requisito de "aviso de
--    dependências antes de arquivar" (ADR-0003) ser eficiente.
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_protocol_days_tenant ON protocol_days(tenant_id);
CREATE INDEX IF NOT EXISTS idx_protocol_days_protocol_day_number ON protocol_days(protocol_id, day_number);

CREATE INDEX IF NOT EXISTS idx_protocol_items_tenant ON protocol_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_protocol_items_day_order ON protocol_items(protocol_day_id, order_index);
CREATE INDEX IF NOT EXISTS idx_protocol_items_kind ON protocol_items(item_kind);
CREATE INDEX IF NOT EXISTS idx_protocol_items_recipe ON protocol_items(recipe_id) WHERE recipe_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_items_meal ON protocol_items(meal_id) WHERE meal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_items_shot ON protocol_items(shot_id) WHERE shot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_items_tea ON protocol_items(tea_id) WHERE tea_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_items_supplement ON protocol_items(supplement_id) WHERE supplement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_items_material ON protocol_items(material_id) WHERE material_id IS NOT NULL;
