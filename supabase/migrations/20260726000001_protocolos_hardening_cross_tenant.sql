-- ============================================================
-- Arquitetura "Método Clínico" — Sub-fase 3: Protocolos, hardening
-- pós-revisão do PR1 (20260722000004_protocolos_subfase3_pr1_schema.sql,
-- já aplicada em produção — ver docs/architecture/sub-fase-3-protocolos.md,
-- "Histórico pós-fechamento").
--
-- Três achados de revisão automatizada do PR, todos na mesma classe:
-- FKs entre camadas provavam que o registro pai existia, mas não que
-- ele pertencia ao mesmo tenant da linha filha. Como as políticas de
-- escrita de RLS só validam o tenant_id da própria linha, um admin
-- podia gravar uma linha com seu próprio tenant_id apontando para um
-- pai de outro tenant. Corrigido com FK composta (coluna_id, tenant_id)
-- em cada relação, substituindo a FK simples. 100% aditivo/correção:
-- nenhuma coluna nova de negócio, só integridade referencial reforçada
-- e uma reescrita de função existente.
-- 2026-07-26
-- ============================================================

-- ------------------------------------------------------------
-- 1. Integridade cross-tenant entre camadas (protocol_days→protocols,
--    protocol_items→protocol_days, protocol_goals→protocols).
--
--    Um admin do Tenant A podia inserir um protocol_days com
--    tenant_id=A mas protocol_id apontando para um protocolo do
--    Tenant B (RLS passa, pois só olha o tenant_id da própria linha)
--    — e, para um protocolo standalone público
--    (`/api/public/protocols/[slug]`, que expõe o id publicamente),
--    isso permitia injetar dias/itens na página de vendas de outro
--    tenant. O mesmo valia para protocol_items→protocol_days e
--    protocol_goals→protocols.
--
--    Corrigido com FK composta (protocol_id/protocol_day_id, tenant_id)
--    contra uma UNIQUE(id, tenant_id) do pai — o banco passa a rejeitar
--    fisicamente qualquer linha cujo tenant_id não bata com o do pai,
--    independente da política de RLS. Achado adicional durante esta
--    correção: protocol_items.protocol_day_id nunca teve FK real em
--    produção (a única declaração conhecida, em
--    legacy-manual-sql/fix_protocols_schema.sql, nunca chegou a rodar
--    contra a tabela já existente — mesma classe de drift silencioso
--    do Achado 0.2 do documento de arquitetura) — a FK composta abaixo
--    também fecha essa lacuna de integridade referencial, não só a de
--    tenant.
-- ------------------------------------------------------------

-- UNIQUE(id, tenant_id) guardado por existência (nunca DROP+ADD): as FKs
-- compostas abaixo passam a depender deste índice, e um DROP incondicional
-- falharia em reaplicações ("outros objetos dependem dele") — a UNIQUE
-- em si nunca precisa mudar, só as FKs que a referenciam.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'protocols'::regclass AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(id, tenant_id)%'
  ) THEN
    ALTER TABLE protocols ADD CONSTRAINT protocols_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'protocol_days'::regclass AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(id, tenant_id)%'
  ) THEN
    ALTER TABLE protocol_days ADD CONSTRAINT protocol_days_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
END $$;

-- FKs compostas — seguras para DROP+ADD (nada depende delas).
ALTER TABLE protocol_days DROP CONSTRAINT IF EXISTS protocol_days_protocol_id_fkey;
ALTER TABLE protocol_days DROP CONSTRAINT IF EXISTS protocol_days_protocol_id_tenant_id_fkey;
ALTER TABLE protocol_days
  ADD CONSTRAINT protocol_days_protocol_id_tenant_id_fkey
  FOREIGN KEY (protocol_id, tenant_id) REFERENCES protocols(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_protocol_day_id_fkey;
ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_protocol_day_id_tenant_id_fkey;
ALTER TABLE protocol_items
  ADD CONSTRAINT protocol_items_protocol_day_id_tenant_id_fkey
  FOREIGN KEY (protocol_day_id, tenant_id) REFERENCES protocol_days(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE protocol_goals DROP CONSTRAINT IF EXISTS protocol_goals_protocol_id_fkey;
ALTER TABLE protocol_goals DROP CONSTRAINT IF EXISTS protocol_goals_protocol_id_tenant_id_fkey;
ALTER TABLE protocol_goals
  ADD CONSTRAINT protocol_goals_protocol_id_tenant_id_fkey
  FOREIGN KEY (protocol_id, tenant_id) REFERENCES protocols(id, tenant_id) ON DELETE CASCADE;

-- ------------------------------------------------------------
-- 2. Integridade cross-tenant nas FOLHAS: as 6 FKs de Ativo Clínico
--    de protocol_items e o goal_id de protocol_goals.
--
--    As FKs simples recipe_id/meal_id/.../material_id só provam que o
--    Ativo Clínico referenciado existe — não que ele pertence ao
--    mesmo tenant do item que o referencia. Um admin do Tenant A podia
--    criar um protocol_item com tenant_id=A (RLS passa) mas recipe_id
--    apontando para uma receita do Tenant B, vazando conteúdo privado
--    de outro tenant (título/instruções) para dentro do próprio
--    protocolo — e o mesmo valia para protocol_goals.goal_id.
--
--    Corrigido com o mesmo padrão da Seção 1: UNIQUE(id, tenant_id)
--    em cada tabela da Biblioteca Clínica envolvida + FK composta
--    (coluna_id, tenant_id). Como recipe_id/meal_id/etc. são nullable
--    (só 1 das 6 preenchida por linha, via CHECK já existente), a
--    semântica padrão MATCH SIMPLE do Postgres já cobre isso de graça:
--    uma FK composta com qualquer coluna NULL é automaticamente
--    satisfeita, então as outras 5 FKs "vazias" de cada linha nunca
--    bloqueiam o insert — só a FK cuja coluna está de fato preenchida
--    passa a validar o tenant.
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'recipes'::regclass AND contype = 'u' AND pg_get_constraintdef(oid) ILIKE '%(id, tenant_id)%') THEN
    ALTER TABLE recipes ADD CONSTRAINT recipes_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'meals'::regclass AND contype = 'u' AND pg_get_constraintdef(oid) ILIKE '%(id, tenant_id)%') THEN
    ALTER TABLE meals ADD CONSTRAINT meals_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'shots'::regclass AND contype = 'u' AND pg_get_constraintdef(oid) ILIKE '%(id, tenant_id)%') THEN
    ALTER TABLE shots ADD CONSTRAINT shots_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'teas'::regclass AND contype = 'u' AND pg_get_constraintdef(oid) ILIKE '%(id, tenant_id)%') THEN
    ALTER TABLE teas ADD CONSTRAINT teas_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'supplements'::regclass AND contype = 'u' AND pg_get_constraintdef(oid) ILIKE '%(id, tenant_id)%') THEN
    ALTER TABLE supplements ADD CONSTRAINT supplements_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'materials'::regclass AND contype = 'u' AND pg_get_constraintdef(oid) ILIKE '%(id, tenant_id)%') THEN
    ALTER TABLE materials ADD CONSTRAINT materials_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'goals'::regclass AND contype = 'u' AND pg_get_constraintdef(oid) ILIKE '%(id, tenant_id)%') THEN
    ALTER TABLE goals ADD CONSTRAINT goals_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
END $$;

ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_recipe_id_fkey;
ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_recipe_id_tenant_id_fkey;
ALTER TABLE protocol_items ADD CONSTRAINT protocol_items_recipe_id_tenant_id_fkey
  FOREIGN KEY (recipe_id, tenant_id) REFERENCES recipes(id, tenant_id);

ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_meal_id_fkey;
ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_meal_id_tenant_id_fkey;
ALTER TABLE protocol_items ADD CONSTRAINT protocol_items_meal_id_tenant_id_fkey
  FOREIGN KEY (meal_id, tenant_id) REFERENCES meals(id, tenant_id);

ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_shot_id_fkey;
ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_shot_id_tenant_id_fkey;
ALTER TABLE protocol_items ADD CONSTRAINT protocol_items_shot_id_tenant_id_fkey
  FOREIGN KEY (shot_id, tenant_id) REFERENCES shots(id, tenant_id);

ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_tea_id_fkey;
ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_tea_id_tenant_id_fkey;
ALTER TABLE protocol_items ADD CONSTRAINT protocol_items_tea_id_tenant_id_fkey
  FOREIGN KEY (tea_id, tenant_id) REFERENCES teas(id, tenant_id);

ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_supplement_id_fkey;
ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_supplement_id_tenant_id_fkey;
ALTER TABLE protocol_items ADD CONSTRAINT protocol_items_supplement_id_tenant_id_fkey
  FOREIGN KEY (supplement_id, tenant_id) REFERENCES supplements(id, tenant_id);

ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_material_id_fkey;
ALTER TABLE protocol_items DROP CONSTRAINT IF EXISTS protocol_items_material_id_tenant_id_fkey;
ALTER TABLE protocol_items ADD CONSTRAINT protocol_items_material_id_tenant_id_fkey
  FOREIGN KEY (material_id, tenant_id) REFERENCES materials(id, tenant_id);

ALTER TABLE protocol_goals DROP CONSTRAINT IF EXISTS protocol_goals_goal_id_fkey;
ALTER TABLE protocol_goals DROP CONSTRAINT IF EXISTS protocol_goals_goal_id_tenant_id_fkey;
ALTER TABLE protocol_goals ADD CONSTRAINT protocol_goals_goal_id_tenant_id_fkey
  FOREIGN KEY (goal_id, tenant_id) REFERENCES goals(id, tenant_id);

-- ------------------------------------------------------------
-- 3. duplicate_protocol — correção funcional + de segurança.
--
--    A RPC (legacy-manual-sql/fix_protocols_schema.sql) está viva —
--    chamada pelo botão "Duplicar" real de ProtocolsView.tsx via
--    useProtocols().duplicateProtocol() (lib/hooks/useDatabase.ts).
--    Sem esta correção, duplicar qualquer protocolo com dias falharia
--    na primeira linha copiada por violar o NOT NULL de tenant_id
--    (introduzido na migração base já aplicada) — inofensivo até agora
--    só porque protocol_days está vazia em produção, mas quebraria
--    assim que o primeiro protocolo real tivesse dias.
--
--    Reescrita para: preencher tenant_id (reaproveitado do protocolo
--    original) em protocol_days/protocol_items; copiar também
--    item_kind e as 6 FKs de Ativo Clínico (sem isso, duplicar um
--    protocolo silenciosamente perderia toda referência à Biblioteca
--    Clínica assim que o PR2 passar a populá-las); copiar
--    protocol_goals (ADR-0003 — referenciar, nunca copiar o ativo,
--    mas a associação protocolo→meta em si deve ser duplicada);
--    copiar method_phase_id (propriedade do protocolo).
--
--    Achado de segurança na mesma revisão: sendo SECURITY DEFINER,
--    esta função roda com privilégio elevado e NÃO está sujeita a
--    RLS — as políticas de protocols/protocol_days/protocol_items/
--    protocol_goals simplesmente não se aplicam às queries daqui de
--    dentro. Sem uma checagem própria, qualquer usuário autenticado —
--    de QUALQUER tenant, já que o REVOKE de 20260514000003 só tira o
--    EXECUTE de "anon", não de "authenticated"/PUBLIC — podia duplicar
--    o protocolo de OUTRO tenant só sabendo o id (ex.: exposto
--    publicamente em /api/public/protocols/[slug] para protocolos
--    standalone). Corrigido com uma checagem explícita de autorização
--    no início da função, replicando a mesma regra "admin/nutritionist
--    do próprio tenant" já usada nas políticas de RLS — já que RLS não
--    protege aqui, a função precisa se proteger sozinha. SET search_path
--    repetido explicitamente na própria definição para não depender da
--    ALTER FUNCTION separada de 20260514000003 sobreviver a este
--    CREATE OR REPLACE.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION duplicate_protocol(p_protocol_id UUID)
RETURNS UUID AS $$
DECLARE
    v_new_protocol_id UUID;
    v_tenant_id UUID;
    v_day RECORD;
    v_new_day_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM protocols p
        JOIN profiles pr ON pr.tenant_id = p.tenant_id
        WHERE p.id = p_protocol_id
          AND pr.user_id = auth.uid()
          AND pr.role IN ('admin', 'nutritionist')
    ) THEN
        RAISE EXCEPTION 'Não autorizada a duplicar este protocolo';
    END IF;

    INSERT INTO protocols (
        title, description, duration_days, cover_image_url, category,
        tenant_id, is_template, method_phase_id
    )
    SELECT
        title || ' (Cópia)', description, duration_days, cover_image_url, category,
        tenant_id, is_template, method_phase_id
    FROM protocols
    WHERE id = p_protocol_id
    RETURNING id, tenant_id INTO v_new_protocol_id, v_tenant_id;

    FOR v_day IN (SELECT * FROM protocol_days WHERE protocol_id = p_protocol_id ORDER BY day_number) LOOP
        INSERT INTO protocol_days (protocol_id, tenant_id, day_number, title, subtitle)
        VALUES (v_new_protocol_id, v_tenant_id, v_day.day_number, v_day.title, v_day.subtitle)
        RETURNING id INTO v_new_day_id;

        INSERT INTO protocol_items (
            protocol_day_id, tenant_id, time, type, item_kind, title, description,
            ingredients, recipe, video_url, is_mandatory, points, points_camera,
            points_gallery, image_url, order_index,
            recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id,
            quantity, unit, serving_label
        )
        SELECT
            v_new_day_id, v_tenant_id, time, type, item_kind, title, description,
            ingredients, recipe, video_url, is_mandatory, points, points_camera,
            points_gallery, image_url, order_index,
            recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id,
            quantity, unit, serving_label
        FROM protocol_items
        WHERE protocol_day_id = v_day.id;
    END LOOP;

    INSERT INTO protocol_goals (protocol_id, goal_id, tenant_id, sort_order)
    SELECT v_new_protocol_id, goal_id, v_tenant_id, sort_order
    FROM protocol_goals
    WHERE protocol_id = p_protocol_id;

    RETURN v_new_protocol_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.duplicate_protocol(uuid) FROM anon;
