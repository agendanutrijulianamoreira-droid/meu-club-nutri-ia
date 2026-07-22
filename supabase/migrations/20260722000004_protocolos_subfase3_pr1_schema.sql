-- ============================================================
-- Arquitetura "Método Clínico" — Sub-fase 3, PR1: Fundação de schema
-- para Protocolos. Só banco/RLS/integridade — nenhuma tela ou API
-- muda de comportamento nesta migração (ProtocolsView continua lendo
-- protocols.content até o PR2).
--
-- Segue exatamente a ordem de operações de
-- docs/architecture/sub-fase-3-protocolos.md, Seção 2.8: colunas
-- novas (nullable) -> limpeza/backfill -> validação -> restrições
-- irreversíveis (NOT NULL, CHECK, FK, UNIQUE). Cada passo irreversível
-- é precedido por uma validação que aborta a migração (RAISE
-- EXCEPTION) se a contagem não for zero, em vez de tentar "corrigir
-- durante a execução".
--
-- Contagens de produção reconfirmadas nesta sessão, imediatamente
-- antes de escrever esta migração (2026-07-22): protocols=2,
-- protocol_days=0, protocol_items=14 (todas as 14 órfãs — nenhuma bate
-- com um protocol_days.id existente), protocol_assignments=0,
-- protocol_progress=0, goals=0. Idêntico ao levantado na investigação
-- da Sub-fase 1 (2026-07-21) — nada mudou.
--
-- Uma primeira tentativa de aplicar esta migração abortou (transação
-- revertida por inteiro, nenhuma coluna nova chegou a persistir) ao
-- tentar recriar duas constraints de protocol_progress que já existiam
-- em produção: a UNIQUE(assignment_id, protocol_item_id) sempre existiu
-- desde a criação original da tabela (schema_extended.sql) — o
-- documento de arquitetura errou ao descrevê-la como ausente, sem
-- ninguém pegar isso em 4 rodadas de revisão; e a FK de
-- protocol_item_id -> protocol_items(id) ON DELETE CASCADE já existia
-- em produção por origem não rastreada em nenhuma migration do
-- repositório, mas com a definição exata pretendida. Corrigido abaixo
-- com guardas IF NOT EXISTS.
-- 2026-07-22
-- ============================================================

-- ============================================================
-- 0. Limpeza: as 14 linhas órfãs de protocol_items não podem ser
--    tenant-escopadas (não há protocol_days válido para derivar o
--    tenant) e não são alcançáveis por nenhuma tela hoje. Removidas
--    antes do backfill de tenant_id (Seção 2.8 do documento).
-- ============================================================

DELETE FROM protocol_items
WHERE protocol_day_id NOT IN (SELECT id FROM protocol_days);

-- ============================================================
-- 1. protocols.method_phase_id — liga o protocolo à fase da jornada
--    (Sub-fase 1). Nullable: nenhuma tela usa isso ainda.
-- ============================================================

ALTER TABLE protocols
  ADD COLUMN IF NOT EXISTS method_phase_id uuid REFERENCES method_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_protocols_method_phase ON protocols(method_phase_id);

-- ============================================================
-- 2. protocol_days — tenant_id (novo, denormalizado — Seção 2.7 do
--    documento) + UNIQUE(protocol_id, day_number).
-- ============================================================

ALTER TABLE protocol_days
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill: protocol_id é NOT NULL com FK válida para protocols, então
-- todo protocol_day tem um protocols.tenant_id para copiar.
UPDATE protocol_days pd
SET tenant_id = p.tenant_id
FROM protocols p
WHERE p.id = pd.protocol_id
  AND pd.tenant_id IS NULL;

-- Validação antes do passo irreversível (NOT NULL) — aborta se falhar.
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM protocol_days WHERE tenant_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Migração abortada: % linha(s) de protocol_days sem tenant_id após backfill', v_count;
  END IF;
END $$;

ALTER TABLE protocol_days ALTER COLUMN tenant_id SET NOT NULL;

-- Validação antes do UNIQUE (protocol_id, day_number) — aborta se falhar.
-- Guardado por IF NOT EXISTS (via pg_constraint): reexecuções seguras desta
-- migração (ex. depois de uma tentativa anterior abortada por outro motivo)
-- não devem falhar em "constraint já existe".
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM (
    SELECT protocol_id, day_number FROM protocol_days GROUP BY 1, 2 HAVING count(*) > 1
  ) dup;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Migração abortada: % combinação(ões) duplicada(s) de (protocol_id, day_number) em protocol_days', v_count;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'protocol_days_protocol_day_number_unique') THEN
    ALTER TABLE protocol_days ADD CONSTRAINT protocol_days_protocol_day_number_unique UNIQUE (protocol_id, day_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_protocol_days_protocol ON protocol_days(protocol_id, day_number);
CREATE INDEX IF NOT EXISTS idx_protocol_days_tenant ON protocol_days(tenant_id);

-- ============================================================
-- 3. protocol_items — redesenho (Seção 2.3/3 do documento):
--    tenant_id, item_kind, 6 FKs nullable mutuamente exclusivas,
--    overrides de instância (quantity/unit/serving_label). Colunas
--    legadas (type/ingredients/recipe) permanecem por enquanto —
--    removidas só no PR4.
-- ============================================================

ALTER TABLE protocol_items
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- item_kind: DEFAULT 'custom' (não 'clinical_asset') é deliberado —
-- é o único valor compatível com 0 FKs preenchidas, que é o estado de
-- qualquer linha pré-existente (as 6 FKs abaixo são colunas novas).
ALTER TABLE protocol_items
  ADD COLUMN IF NOT EXISTS item_kind text NOT NULL DEFAULT 'custom';

ALTER TABLE protocol_items
  ADD COLUMN IF NOT EXISTS recipe_id     uuid REFERENCES recipes(id),
  ADD COLUMN IF NOT EXISTS meal_id       uuid REFERENCES meals(id),
  ADD COLUMN IF NOT EXISTS shot_id       uuid REFERENCES shots(id),
  ADD COLUMN IF NOT EXISTS tea_id        uuid REFERENCES teas(id),
  ADD COLUMN IF NOT EXISTS supplement_id uuid REFERENCES supplements(id),
  ADD COLUMN IF NOT EXISTS material_id   uuid REFERENCES materials(id);

ALTER TABLE protocol_items
  ADD COLUMN IF NOT EXISTS quantity      numeric,
  ADD COLUMN IF NOT EXISTS unit          text,
  ADD COLUMN IF NOT EXISTS serving_label text;

-- Backfill de tenant_id: protocol_day_id agora só referencia
-- protocol_days válidos (órfãos já removidos no passo 0).
UPDATE protocol_items pi
SET tenant_id = pd.tenant_id
FROM protocol_days pd
WHERE pd.id = pi.protocol_day_id
  AND pi.tenant_id IS NULL;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM protocol_items WHERE tenant_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Migração abortada: % linha(s) de protocol_items sem tenant_id após backfill', v_count;
  END IF;
END $$;

ALTER TABLE protocol_items ALTER COLUMN tenant_id SET NOT NULL;

-- Validação antes do CHECK forte (item_kind <-> contagem de FKs) —
-- aborta se falhar.
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM protocol_items
  WHERE NOT (
    (item_kind = 'custom'         AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 0)
    OR
    (item_kind = 'clinical_asset' AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 1)
  );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Migração abortada: % linha(s) de protocol_items violariam o CHECK item_kind/FKs', v_count;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'protocol_items_kind_check') THEN
    ALTER TABLE protocol_items ADD CONSTRAINT protocol_items_kind_check CHECK (
      item_kind IN ('clinical_asset', 'custom')
      AND (
        (item_kind = 'custom'         AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 0)
        OR
        (item_kind = 'clinical_asset' AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 1)
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_protocol_items_day        ON protocol_items(protocol_day_id, order_index);
CREATE INDEX IF NOT EXISTS idx_protocol_items_tenant     ON protocol_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_protocol_items_kind       ON protocol_items(item_kind);
CREATE INDEX IF NOT EXISTS idx_protocol_items_recipe     ON protocol_items(recipe_id)     WHERE recipe_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_items_meal       ON protocol_items(meal_id)       WHERE meal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_items_shot       ON protocol_items(shot_id)       WHERE shot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_items_tea        ON protocol_items(tea_id)        WHERE tea_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_items_supplement ON protocol_items(supplement_id) WHERE supplement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_items_material   ON protocol_items(material_id)   WHERE material_id IS NOT NULL;

-- ============================================================
-- 4. protocol_progress — FK real em protocol_item_id + UNIQUE
--    (assignment_id, protocol_item_id).
--
-- Achado durante a aplicação desta migração (correção ao documento de
-- arquitetura): a UNIQUE(assignment_id, protocol_item_id) já existia
-- desde a criação original da tabela (supabase/schema_extended.sql) —
-- o documento de arquitetura afirmou incorretamente que ela precisava
-- ser criada agora; passou despercebido em 4 rodadas de revisão. A FK
-- de protocol_item_id -> protocol_items(id) ON DELETE CASCADE também
-- já existe em produção (origem não seguida por nenhuma migration do
-- repositório — provavelmente aplicada manualmente em algum momento),
-- mas com a definição exata que este documento pretendia. Guardado por
-- IF NOT EXISTS para não falhar em "já existe" e permanecer idempotente.
-- ============================================================

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM protocol_progress pp
  WHERE NOT EXISTS (SELECT 1 FROM protocol_items pi WHERE pi.id = pp.protocol_item_id);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Migração abortada: % linha(s) de protocol_progress referenciam protocol_item_id inexistente', v_count;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'protocol_progress_protocol_item_id_fkey') THEN
    ALTER TABLE protocol_progress
      ADD CONSTRAINT protocol_progress_protocol_item_id_fkey
      FOREIGN KEY (protocol_item_id) REFERENCES protocol_items(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM (
    SELECT assignment_id, protocol_item_id FROM protocol_progress GROUP BY 1, 2 HAVING count(*) > 1
  ) dup;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Migração abortada: % combinação(ões) duplicada(s) de (assignment_id, protocol_item_id) em protocol_progress', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'protocol_progress'::regclass AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (assignment_id, protocol_item_id)'
  ) THEN
    ALTER TABLE protocol_progress
      ADD CONSTRAINT protocol_progress_assignment_item_unique
      UNIQUE (assignment_id, protocol_item_id);
  END IF;
END $$;

-- ============================================================
-- 5. protocol_goals — única tabela de junção protocol_* desta
--    sub-fase (Seção 2.4 do documento). Liga Metas a um Protocolo
--    inteiro; nunca a um item agendado (protocol_items não tem
--    goal_id).
-- ============================================================

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

-- ============================================================
-- 6. RLS de protocol_days/protocol_items — reescrita obrigatória
--    (Achado 0.2/Seção 2.6 do documento). A política atual
--    (`USING (true)` só de SELECT, nenhuma de escrita) permite
--    leitura cross-tenant e bloqueia toda escrita não-service-role —
--    é a causa raiz do bug em que "Sazonais" nunca persiste dias/itens.
-- ============================================================

DROP POLICY IF EXISTS "authenticated_read_protocol_days" ON protocol_days;
DROP POLICY IF EXISTS "authenticated_read_protocol_items" ON protocol_items;

CREATE POLICY "Tenant patients can read active protocol_days"
  ON protocol_days FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_days.tenant_id));

CREATE POLICY "Admin manages own protocol_days"
  ON protocol_days FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_days.tenant_id AND profiles.role IN ('admin','nutritionist')));

CREATE POLICY "Tenant patients can read active protocol_items"
  ON protocol_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_items.tenant_id));

CREATE POLICY "Admin manages own protocol_items"
  ON protocol_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_items.tenant_id AND profiles.role IN ('admin','nutritionist')));
