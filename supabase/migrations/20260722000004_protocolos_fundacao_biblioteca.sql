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
--
-- NOTA DE RECONCILIAÇÃO (2026-07-24, antes do merge, arquivo nunca
-- aplicado em produção até este ponto): uma verificação de contagens
-- de produção imediatamente antes do merge encontrou uma migração já
-- aplicada diretamente no banco por fora do git (registrada no
-- histórico do Supabase como "20260722015927 protocolos_subfase3_pr1_schema",
-- sem arquivo correspondente em nenhuma branch deste repositório),
-- criando um schema funcionalmente idêntico ao deste arquivo — mesmas
-- colunas, tipos, defaults e FKs em protocol_items/protocol_days/
-- protocol_goals/protocols. As únicas diferenças eram de nome
-- (constraint UNIQUE de protocol_days e duas políticas de leitura),
-- já reconciliadas abaixo adotando os nomes que já estavam em produção,
-- em vez de criar objetos duplicados. Ver docs/architecture/sub-fase-3-protocolos.md
-- para o registro completo dessa reconciliação e da mudança de contagem
-- de protocol_items órfãos (14 em 21/07 → 0 em 22/07).
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
--    Guardado via checagem em pg_constraint (em vez de DROP+ADD por
--    nome fixo): reconciliação pós-rehearsal — este ambiente já tinha
--    essa mesma UNIQUE aplicada por fora do git, sob o nome
--    protocol_days_protocol_day_number_unique. Adota esse nome como
--    canônico daqui em diante em vez de criar um segundo constraint
--    redundante sob um nome diferente.
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'protocol_days'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(protocol_id, day_number)%'
  ) THEN
    ALTER TABLE protocol_days
      ADD CONSTRAINT protocol_days_protocol_day_number_unique
      UNIQUE (protocol_id, day_number);
  END IF;
END $$;

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

DROP POLICY IF EXISTS "Tenant members can read protocol_goals" ON protocol_goals;
CREATE POLICY "Tenant members can read protocol_goals"
  ON protocol_goals FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_goals.tenant_id));

DROP POLICY IF EXISTS "Admin manages own protocol_goals" ON protocol_goals;
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
--
--    Nomes das políticas reconciliados pós-rehearsal: este ambiente
--    já tinha uma versão funcionalmente idêntica destas 4 políticas
--    aplicada por fora do git (mesmo USING, nomes "...protocol_days"/
--    "...protocol_items" em vez de "...protocol content days"/
--    "...content items"). Adotados os nomes já existentes para não
--    criar políticas de leitura duplicadas.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "authenticated_read_protocol_days" ON protocol_days;
DROP POLICY IF EXISTS "authenticated_read_protocol_items" ON protocol_items;

DROP POLICY IF EXISTS "Tenant patients can read active protocol_days" ON protocol_days;
CREATE POLICY "Tenant patients can read active protocol_days"
  ON protocol_days FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_days.tenant_id));

DROP POLICY IF EXISTS "Admin manages own protocol_days" ON protocol_days;
CREATE POLICY "Admin manages own protocol_days"
  ON protocol_days FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_days.tenant_id AND profiles.role IN ('admin','nutritionist')));

DROP POLICY IF EXISTS "Tenant patients can read active protocol_items" ON protocol_items;
CREATE POLICY "Tenant patients can read active protocol_items"
  ON protocol_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_items.tenant_id));

DROP POLICY IF EXISTS "Admin manages own protocol_items" ON protocol_items;
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

-- ------------------------------------------------------------
-- 10. Integridade cross-tenant (achado P1 da revisão do PR).
--
--    As políticas de escrita da Seção 8 (`USING (profiles.tenant_id =
--    protocol_days.tenant_id)`) só validam que o admin pertence ao
--    tenant_id GRAVADO na própria linha — não validam que esse
--    tenant_id bate com o tenant_id do PROTOCOLO PAI referenciado por
--    protocol_id. Sem essa amarração, um admin do Tenant A podia
--    inserir um protocol_days com tenant_id=A mas protocol_id apontando
--    para um protocolo do Tenant B (RLS passa, pois só olha o tenant_id
--    da própria linha) — e, para um protocolo standalone público
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
--    já documentada no Achado 0.2) — a FK composta abaixo também fecha
--    essa lacuna de integridade referencial, não só a de tenant.
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
-- 11. duplicate_protocol (achado P2 da revisão do PR).
--
--    A RPC (legacy-manual-sql/fix_protocols_schema.sql) está viva —
--    chamada pelo botão "Duplicar" real de ProtocolsView.tsx via
--    useProtocols().duplicateProtocol() (lib/hooks/useDatabase.ts) —,
--    ao contrário do que o Achado 0.3 deste documento presumia
--    ("hoje órfã, só chamada pelo builder relacional sem link de
--    menu" — essa frase descrevia lib/hooks/useProtocolBuilder.ts,
--    que É órfão, mas useDatabase.ts::duplicateProtocol não é).
--    Sem esta correção, duplicar qualquer protocolo com dias falharia
--    na primeira linha copiada por violar o NOT NULL de tenant_id
--    introduzido nesta mesma migração — inofensivo hoje só porque
--    protocol_days está vazia em produção, mas quebraria assim que a
--    primeira paciente/protocolo real tivesse dias.
--
--    Reescrita para: preencher tenant_id (reaproveitado do protocolo
--    original) em protocol_days/protocol_items; copiar também
--    item_kind e as 6 FKs de Ativo Clínico (sem isso, duplicar um
--    protocolo silenciosamente perderia toda referência à Biblioteca
--    Clínica assim que o PR2 passar a populá-las); copiar
--    protocol_goals (ADR-0003 — referenciar, nunca copiar o ativo,
--    mas a associação protocolo→meta em si deve ser duplicada).
--    method_phase_id também passa a ser copiado (propriedade do
--    protocolo, não um Ativo Clínico). SET search_path repetido
--    explicitamente na própria definição para não depender da
--    ALTER FUNCTION separada de 20260514000003 sobreviver a um
--    CREATE OR REPLACE futuro sem essa cláusula.
--
--    Achado P1 de uma segunda rodada de revisão (aplicado sobre este
--    mesmo CREATE OR REPLACE, ainda dentro desta PR): sendo
--    SECURITY DEFINER, esta função roda com privilégio elevado e
--    NÃO está sujeita a RLS — as políticas de protocols/protocol_days/
--    protocol_items/protocol_goals (Seções 8 e 7) simplesmente não se
--    aplicam às queries daqui de dentro. Sem uma checagem própria, a
--    função original (e a reescrita do achado P2 acima) permitia
--    qualquer usuário autenticado — de QUALQUER tenant, já que o
--    REVOKE de 20260514000003 só tira o EXECUTE de "anon", não de
--    "authenticated"/PUBLIC — duplicar o protocolo de OUTRO tenant só
--    sabendo o id (ex.: exposto publicamente em
--    /api/public/protocols/[slug] para protocolos standalone).
--    Corrigido com uma checagem explícita de autorização no início da
--    função, replicando a mesma regra "admin/nutritionist do próprio
--    tenant" já usada nas políticas de RLS desta migração — já que
--    RLS não protege aqui, a função precisa se proteger sozinha.
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
