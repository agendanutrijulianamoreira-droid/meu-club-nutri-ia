# Arquitetura da Sub-fase 3 — Protocolos

**Status:** Aprovado para implementação — quarta versão. Arquitetura sem pendências estruturais; ajustes desta versão são checklist de execução da migração do PR1 (**um deles corrigiu um bug real de ordem de operações**, ver abaixo), não mudanças de modelo.
**Data:** 2026-07-21
**Escopo deste documento:** modelagem e validação arquitetural. A implementação começa pelo **PR1** (Seção 9) seguindo exatamente a ordem de operações da Seção 2.8.

**Mudanças da segunda versão (primeira rodada de revisão):** (1) `goal_id` removido de `protocol_items` — Metas só se ligam a um Protocolo inteiro via `protocol_goals`, nunca a um item agendado (Seções 2.3/2.4); (2) `item_kind` (`clinical_asset`/`custom`) adicionado como discriminador explícito, em vez de inferir pela ausência de FKs (Seção 2.3); (3) `CHECK` fortalecido para amarrar `item_kind` à contagem de FKs preenchidas, não só `<= 1` (Seção 2.3); (4) `UNIQUE(assignment_id, protocol_item_id)` adicionada em `protocol_progress` (Seção 2.5); (5) denormalização de `tenant_id` e (6) referência "ao vivo" sem versionamento elevadas a decisões arquiteturais explícitas, com o cenário concreto de risco documentado (nova Seção 2.7); terminologia da Seção 3 corrigida de "referência polimórfica" para "nullable foreign keys mutuamente exclusivas"; PR1 (Seção 9) passou a incluir a correção do erro engolido em `seasonal-protocols/route.ts`.

**Mudanças da terceira versão (segunda rodada de revisão):** regra de precedência dos overrides (`title`/`description`/`quantity`/`unit`/`serving_label`: NULL → usar o valor do Ativo Clínico) explicitada em texto na Seção 2.3, em vez de ficar implícita; nota de implementação sobre o duplo papel de `title`/`description` conforme `item_kind`, sinalizando (sem mudar o schema) que um DTO/ViewModel de leitura pode ser necessário se o builder acumular condicionais; nota sobre a evolução futura de `UNIQUE(assignment_id, protocol_item_id)` caso "refazer atividade" seja implementado um dia (Seção 2.5).

**Mudanças da quarta versão (checklist de migração do PR1, terceira rodada de revisão) — nova Seção 2.8:** (1) confirmado que o PR1 é 100% aditivo; (2) confirmado que as 6 novas FKs em `protocol_items` são nullable desde o início; (3) **bug real encontrado e corrigido**: `item_kind` tinha `DEFAULT 'clinical_asset'` na versão anterior — combinado com as 14 linhas legadas órfãs de `protocol_items` (0 FKs preenchidas, por serem colunas novas), isso violaria o próprio `CHECK` no momento de aplicar a migração; corrigido para `DEFAULT 'custom'` (Seção 2.3), com a ordem de operações completa (colunas → backfill → `CHECK`) documentada na Seção 2.8; (4) estratégia de backfill de `tenant_id` detalhada, incluindo a exclusão das 14 linhas órfãs de `protocol_items` (não alcançáveis pelo backfill via join, por não terem `protocol_days` correspondente) antes de tornar a coluna `NOT NULL`; (5) disciplina de execução acrescentada — uma consulta de validação (deve retornar zero) antes de cada passo irreversível (`NOT NULL`, `CHECK`, FK, `UNIQUE`), interrompendo a migração em vez de corrigir dado no meio da execução.

**Encerramento da fase de arquitetura:** três rodadas de revisão concluídas sem nenhuma pendência estrutural remanescente. A partir desta versão, o documento é a especificação oficial contra a qual o PR1 é implementado e revisado.

---

## 0. Achados de investigação (fatos verificados no código atual, antes de qualquer decisão de design)

Antes de desenhar o modelo novo, foi necessário entender exatamente o que existe hoje. Os fatos abaixo mudam algumas suposições do planejamento original e **acrescentam um achado novo e relevante**.

### 0.1 Há hoje três consumidores de "conteúdo de protocolo", não dois

1. **`ProtocolsView.tsx` (aba "Protocolos", tela principal, viva)** — lê/escreve `protocols.content` (jsonb), estrutura `[{ day, title, items: [{ item_type, title, points }] }]`, 100% texto livre, sem nenhuma referência a `recipes`/`shots`/etc.
2. **App da paciente (`usePatientEngine.ts` + `/api/patient/protocol-progress`)** — lê exclusivamente a estrutura relacional `protocol_days` → `protocol_items` → `protocol_progress`. Nunca lê `protocols.content`.
3. **Protocolos Sazonais (`/api/admin/seasonal-protocols/*`, aba "Sazonais", também viva e linkada no menu)** — **também** escreve em `protocol_days`/`protocol_items` (não em `content`). Este consumidor não estava mapeado na investigação da Sub-fase 1; foi descoberto agora.

Ou seja: já existem **dois formatos de protocolo em produção simultaneamente** (protocolos normais via `content` jsonb, sazonais via `protocol_days`/`protocol_items`), e um terceiro leitor (a paciente) que só entende o segundo formato. Um protocolo criado pela aba "Protocolos" nunca aparece corretamente no app da paciente, porque a paciente só lê `protocol_days`/`protocol_items` — que a aba "Protocolos" nunca escreve.

### 0.2 Achado novo: o recurso "Sazonais" está com uma escrita silenciosamente quebrada em produção

`app/api/admin/seasonal-protocols/route.ts` insere em `protocol_days`/`protocol_items` usando `createSupabaseServerClient(cookies())` — o cliente da **sessão do usuário**, sujeito a RLS (não é o service role).

A única migração que habilita RLS nessas duas tabelas (`20260514000001_enable_rls_policies.sql`) criou **apenas política de leitura**:

```sql
ALTER TABLE public.protocol_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_protocol_days" ON public.protocol_days FOR SELECT TO authenticated USING (true);
ALTER TABLE public.protocol_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_protocol_items" ON public.protocol_items FOR SELECT TO authenticated USING (true);
```

Não existe nenhuma outra migração adicionando política de `INSERT` para essas tabelas. Pelo comportamento padrão do Postgres, RLS habilitado sem uma política que cubra o comando **nega o comando por padrão** — logo, todo `INSERT` em `protocol_days`/`protocol_items` feito pela rota de Sazonais como usuário autenticado é rejeitado pelo banco. O código não verifica o erro dessa etapa (`if (dayError) continue`, e o insert de items nem checa erro) — a falha é engolida silenciosamente. O protocolo em si é salvo (a tabela `protocols` tem RLS correta), mas **os dias e itens nunca chegam a existir**.

Isso explica, de forma mais completa do que a investigação da Sub-fase 1, por que `protocol_days` está vazia em produção: não é só "ninguém usou o builder relacional órfão" — é que o único fluxo vivo que tenta popular essa estrutura está bloqueado pelo próprio banco, silenciosamente, desde que a política de RLS foi criada.

**Consequência prática:** a Sub-fase 3 não é só uma reforma arquitetural — ela conserta, como efeito direto do redesenho de `protocol_items`, um bug real que hoje impede tanto os protocolos comuns quanto os sazonais de aparecerem corretamente para a paciente.

### 0.3 Outros achados pontuais

- `protocol_items.type` (`meal|shot|workout|content|water|custom`), `.ingredients text[]` e `.recipe text` são todos texto livre — nenhuma referência a Ativo Clínico. Serão substituídos (Seção 2).
- `protocol_progress.protocol_item_id` é `uuid NOT NULL` **sem constraint de FK real** (só um comentário dizendo "referência ao item do protocolo"). Corrigido nesta sub-fase.
- `protocol_days`/`protocol_items` não têm coluna `tenant_id` — nem RLS nem índice conseguem escopar por tenant hoje. Corrigido nesta sub-fase (mesmo padrão de denormalização já usado em toda a Biblioteca Clínica).
- `protocols.goals` (`text[]`, adicionada em `20260702000001_seasonal_protocols.sql`) é uma lista de bullets de marketing para a página de vendas avulsa (ex.: "emagrecer 3kg", "reduzir inchaço") — **não** é uma referência à tabela `goals` (Metas) da Biblioteca Clínica. O nome colide conceitualmente com a nova tabela de junção `protocol_goals` que este documento propõe. Renomear para `sales_goals` (Seção 2).
- `protocols.is_public` existe desde o schema original, é sempre gravada como `false` e **nunca é lida em nenhum lugar do código** — um hook morto, mas pronto, para o marketplace futuro (Seção 6).
- `protocols.is_standalone`/`standalone_slug`/`standalone_price_cents`/`sales_headline`/`sales_description` + tabela `protocol_leads` já implementam venda avulsa completa (Seção 6 — precedente direto para "protocolos públicos").
- Existe uma função `duplicate_protocol(p_protocol_id)` (RPC, `legacy-manual-sql/fix_protocols_schema.sql`) que já duplica protocolo + dias + itens — hoje órfã (só chamada pelo builder relacional sem link de menu) e desatualizada (referencia colunas que serão removidas). Será revivida e atualizada (Seção 6/9).
- `protocol_assignments` e `protocol_progress` (fora do bug do item 0.2) estão corretos: FKs presentes, RLS tenant-scoped, índices nos lugares certos. Não precisam de mudança estrutural.
- Contagens de produção verificadas na investigação da Sub-fase 1 (2026-07-21): `protocols`=2, `protocol_days`=0, `protocol_items`=14 (todos órfãos — `protocol_day_id` não bate com nenhum `protocol_days.id` existente), `protocol_assignments`=0. Como nenhuma sub-fase até agora escreveu nessas tabelas, os números devem seguir os mesmos — ainda assim, serão reconfirmados com uma contagem fresca imediatamente antes de aplicar a migração da Seção 9, por disciplina.

---

## 1. Modelo conceitual

```
Método
  └─ Fase                (etapa da jornada — Sub-fase 1)
       └─ Protocolo       (estratégia/intervenção clínica — N por fase)
            └─ Dia do Protocolo
                 └─ Item do Protocolo
                      └─ Ativo Clínico  (referência, nunca cópia — Sub-fase 2 / ADR-0003)
```

| Camada | Responsabilidade | Por que existe como camada própria |
|---|---|---|
| **Método** | Identidade do método clínico da nutricionista | Um tenant pode, no futuro, ter mais de um método (ex. um método para emagrecimento, outro para gestantes) — precisa de um nó raiz próprio, já resolvido na Sub-fase 1 |
| **Fase** | Em que ponto da jornada a paciente está | Etapa de **evolução da paciente**, não um tipo de intervenção. O mesmo protocolo "Anti-inflamatório" pode ser aplicado em fases diferentes para pacientes diferentes — fase e protocolo variam independentemente |
| **Protocolo** | A intervenção clínica concreta (o "o quê" e "quando") | É o nível certo para agrupar um cronograma de dias e itens porque é o nível que a nutricionista pensa e nomeia ("Protocolo Detox 7 dias") — nem Fase (grande demais, dura semanas) nem Ativo Clínico (pequeno demais, é reutilizável) fazem sentido como unidade de cronograma |
| **Dia do Protocolo** | Agrupamento temporal dentro do protocolo | Sem isso, "Item do Protocolo" teria que carregar `day_number` diretamente, o que já foi tentado (schema legado) e funciona, mas perde a possibilidade de o dia ter seu próprio título/subtítulo (hoje já usado: "Dia 1 — Detox Suave") |
| **Item do Protocolo** | Uma ocorrência agendada de um Ativo Clínico (ou de um item livre) dentro de um dia específico | É a **instância** (ADR-0003): quando referencia um Ativo Clínico, herda conteúdo dele mas pode ter customizações próprias (quantidade, observação); quando não referencia nada, é um item simples (água, exercício livre) que não precisa forçadamente existir como Ativo Clínico |
| **Ativo Clínico** | Conteúdo reutilizável e independente (Sub-fase 2) | Fonte única de verdade — Protocolo nunca cria conteúdo, só referencia (ADR-0004) |

Esta camada de Protocolo é, junto com Dietas e Desafios, um dos **principais consumidores** da Biblioteca Clínica (princípio já estabelecido no planejamento da Sub-fase 1). Nada nesta sub-fase cria uma camada paralela às 8 já definidas em ADR-0001.

---

## 2. Modelo relacional

### 2.1 `protocols` (retrofit — tabela existente, sem recriação)

| Coluna | Tipo | Mudança |
|---|---|---|
| `id`, `tenant_id`, `title`, `description`, `emoji`, `category`, `duration_days`, `is_active`, `is_favorite`, `is_public`, `total_points_available`, `cover_image_url`, `start_date`, `start_time`, `auto_activate`, `scheduled_status`, `is_template`, `shopping_list`, `upsell_*`, `is_standalone`, `standalone_slug`, `standalone_price_cents`, `sales_headline`, `sales_description` | — | **Inalteradas** |
| `goals` (`text[]`) | — | **Renomeada** para `sales_goals` (evita colisão conceitual com `protocol_goals`, Seção 2.4 — é texto de marketing, não FK) |
| `content` (`jsonb`) | — | **Removida** após migração dos dados existentes (Seção 9, PR4) para `protocol_days`/`protocol_items` |
| `method_phase_id` | `uuid REFERENCES method_phases(id) ON DELETE SET NULL` | **Nova**, nullable. Liga o protocolo à fase da jornada em que ele se encaixa. `ON DELETE SET NULL` (não CASCADE): apagar uma fase não deve apagar protocolos, só desvincular |

Índice novo: `idx_protocols_method_phase ON protocols(method_phase_id)`.

### 2.2 `protocol_days` (retrofit)

```sql
id          uuid PK
protocol_id uuid NOT NULL REFERENCES protocols(id) ON DELETE CASCADE
tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE   -- NOVA (denormalizada, padrão Sub-fase 2)
day_number  integer NOT NULL
title       text NOT NULL
subtitle    text
created_at  timestamptz DEFAULT now()
UNIQUE (protocol_id, day_number)                                     -- NOVA
```

Índices: `idx_protocol_days_protocol (protocol_id, day_number)`, `idx_protocol_days_tenant (tenant_id)`.

### 2.3 `protocol_items` (redesenho — a entidade mais importante, ver Seção 3 para a justificativa)

```sql
id               uuid PK
protocol_day_id  uuid NOT NULL REFERENCES protocol_days(id) ON DELETE CASCADE
tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE   -- NOVA

-- Discriminador explícito (revisão do usuário) — nunca inferido implicitamente
-- pela ausência de FKs preenchidas. DEFAULT 'custom' (não 'clinical_asset')
-- é deliberado: é o único valor compatível com toda linha legada existente
-- no momento da migração, que não tem nenhuma das 6 FKs abaixo preenchida
-- (são colunas novas). Ver Seção 2.8 para a ordem de operações completa.
-- A aplicação (PR2) sempre grava item_kind explicitamente ao criar um item
-- novo — o DEFAULT só existe para não quebrar o backfill de linhas antigas.
item_kind        text NOT NULL DEFAULT 'custom' CHECK (item_kind IN ('clinical_asset', 'custom'))

-- Nullable foreign keys mutuamente exclusivas ao Ativo Clínico (Seção 3) —
-- NÃO é polimorfismo de banco (não há entity_type/entity_id genérico); é uma
-- coluna de FK por tipo, com no máximo 1 preenchida por linha.
-- Nota: goal_id foi removida daqui na revisão do usuário — Metas só se ligam
-- a um Protocolo inteiro via protocol_goals (Seção 2.4), nunca a um item
-- agendado num dia/hora específico. Evita o item existir com dois
-- significados possíveis (meta do plano inteiro vs. meta às 9h do Dia 2).
recipe_id        uuid REFERENCES recipes(id)
meal_id          uuid REFERENCES meals(id)
shot_id          uuid REFERENCES shots(id)
tea_id           uuid REFERENCES teas(id)
supplement_id    uuid REFERENCES supplements(id)
material_id      uuid REFERENCES materials(id)

-- CHECK forte (revisão do usuário): não basta "no máximo 1" — item_kind e a
-- contagem de FKs preenchidas precisam concordar entre si, sem brecha para
-- item_kind='custom' com uma FK esquecida preenchida, nem 'clinical_asset'
-- sem nenhuma referência de fato.
CHECK (
  (item_kind = 'custom'         AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 0)
  OR
  (item_kind = 'clinical_asset' AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 1)
)

-- Override de instância (ADR-0003) — sempre presentes, mesmo quando referenciam um mestre
title            text NOT NULL      -- se item_kind='custom': texto livre do item (ex. "Beba 2L de água"); se 'clinical_asset': override opcional do título do mestre
description      text               -- idem, override opcional
quantity         numeric            -- porção/dosagem específica desta ocorrência
unit             text
serving_label    text

time             time
video_url        text
image_url        text               -- já existe hoje (cardápio qualitativo com foto por opção)
is_mandatory     boolean DEFAULT true
points           integer DEFAULT 10
points_camera    integer            -- já existe (Fase 4 do roadmap)
points_gallery   integer            -- já existe
order_index      integer DEFAULT 0
created_at       timestamptz DEFAULT now()
```

**Colunas removidas** (substituídas pelas FKs acima): `type`, `ingredients text[]`, `recipe text`. Nenhuma delas tem dado real em produção hoje (as 14 linhas existentes já são órfãs, sem `protocol_days` correspondente).

**Regra de precedência dos overrides (explicitada por pedido do usuário — antes ficava implícita).** Para `title`, `description`, `quantity`, `unit`, `serving_label` de um item com `item_kind='clinical_asset'`:

```
override (coluna de protocol_items) preenchido?
  → sim: usar o valor do override
  → não (NULL): usar o valor correspondente do Ativo Clínico referenciado
```

`title` é a única coluna com uma diferença adicional: `NOT NULL` no banco, mas semanticamente opcional como override — quando o valor gravado for igual ao padrão que a aplicação usaria de qualquer forma (ou quando a camada de aplicação decidir não gravar um valor próprio), ela grava o próprio título do mestre no momento da criação em vez de deixar uma cadeia de fallback em tempo de leitura só para essa coluna. Isso mantém a regra de precedência acima válida de forma uniforme para as 5 colunas, sem uma exceção especial só para `title`.

**Nota para a implementação (ponto levantado na revisão, não é mudança de schema).** `title`/`description` cumprem dois papéis conforme `item_kind`: em `custom`, são o conteúdo principal do item; em `clinical_asset`, são um override opcional do mestre. O schema aceita essa dualidade de propósito — o ponto de atenção é só de código: se o builder (Seção 9, PR2) acabar cheio de `if (item_kind === 'custom') ... else ...` espalhados pela UI, vale a pena isolar essa distinção num DTO/ViewModel de leitura (ex. um `resolveDisplayFields(item)` que já devolve `{ title, description, quantity, unit, servingLabel }` resolvidos pela regra de precedência acima) em vez de multiplicar condicionais pela tela — sem exigir mudança nenhuma no schema proposto aqui.

Índices:
```
idx_protocol_items_day        (protocol_day_id, order_index)
idx_protocol_items_tenant     (tenant_id)
idx_protocol_items_kind       (item_kind)
idx_protocol_items_recipe     (recipe_id)     WHERE recipe_id IS NOT NULL
idx_protocol_items_meal       (meal_id)       WHERE meal_id IS NOT NULL
idx_protocol_items_shot       (shot_id)       WHERE shot_id IS NOT NULL
idx_protocol_items_tea        (tea_id)        WHERE tea_id IS NOT NULL
idx_protocol_items_supplement (supplement_id) WHERE supplement_id IS NOT NULL
idx_protocol_items_material   (material_id)   WHERE material_id IS NOT NULL
```

Os 6 índices parciais por FK não são só para leitura — são exatamente o que o requisito "aviso de dependências antes de arquivar", documentado no ADR-0003 na Sub-fase 2 (e que ali ficou apenas registrado, sem FK real para verificar), precisa para ser eficiente: `SELECT count(*) FROM protocol_items WHERE recipe_id = $1` deixa de ser um full scan.

### 2.4 `protocol_goals` (nova — única tabela de junção `protocol_*` desta sub-fase)

```sql
id          uuid PK
protocol_id uuid NOT NULL REFERENCES protocols(id) ON DELETE CASCADE
goal_id     uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE
tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
sort_order  integer NOT NULL DEFAULT 0
created_at  timestamptz DEFAULT now()
UNIQUE (protocol_id, goal_id)
```

Índices: `idx_protocol_goals_protocol (protocol_id)`, `idx_protocol_goals_goal (goal_id)`, `idx_protocol_goals_tenant (tenant_id)`.

**Metas só existem aqui — nunca em `protocol_items`.** Revisão importante do usuário: a primeira versão deste documento também permitia `protocol_items.goal_id`, o que dava à Meta dois significados possíveis ao mesmo tempo (algo do protocolo inteiro **ou** algo agendado às 9h do Dia 2). `goal_id` foi removida de `protocol_items` (Seção 2.3) — uma Meta só pode se ligar a um Protocolo como um todo, através desta tabela. Sem ambiguidade.

**Nota importante — desvio deliberado do esboço original.** O planejamento de alto nível herdado da Sub-fase 1 sugeria 8 tabelas de junção (`protocol_recipes`, `protocol_foods`, `protocol_meals`, `protocol_shots`, `protocol_teas`, `protocol_supplements`, `protocol_materials`, `protocol_goals`) para representar "quais ativos este protocolo disponibiliza", separado do cronograma dia-a-dia (`protocol_items`). Neste detalhamento, **essa ideia foi reduzida a apenas `protocol_goals`**, pelo seguinte motivo:

Para recipes/foods/meals/shots/teas/supplements/materials, "quais ativos este protocolo usa" já é **derivável sem duplicação** a partir de `protocol_items` (`SELECT DISTINCT recipe_id FROM protocol_items WHERE protocol_id = X AND recipe_id IS NOT NULL`, e o mesmo para cada FK). Criar uma tabela de junção paralela armazenaria a mesma informação duas vezes — exatamente o que ADR-0001 proíbe ("uma única fonte de verdade"). `goals` é o único caso genuinamente diferente: uma Meta não é agendada num dia/hora específico do cronograma (não faz sentido "Meta às 14h do Dia 3") — ela é uma declaração de foco do protocolo como um todo ("este protocolo trabalha as metas: reduzir inchaço, criar rotina de água"), um conceito que não existe em `protocol_items` e não pode ser derivado dele. Por isso só `goals` precisa de uma tabela própria.

Se, na prática de uso, surgir uma necessidade real de listar "todas as receitas deste protocolo" fora do contexto do cronograma diário (ex. lista de compras, como já existe hoje via `protocols.shopping_list`), a consulta derivada acima resolve isso sem tabela nova. Essa é uma correção explícita ao esboço inicial — sinalizada aqui para revisão, não uma decisão silenciosa.

### 2.5 `protocol_assignments`, `protocol_progress`, `protocol_leads` — sem mudança estrutural, com uma correção

`protocol_assignments` e `protocol_leads` já têm FKs, RLS e índices corretos (verificado na Sub-fase 1 e nesta investigação) — nenhuma mudança.

`protocol_progress` recebe uma correção pontual:

```sql
ALTER TABLE protocol_progress
  ADD CONSTRAINT protocol_progress_protocol_item_id_fkey
  FOREIGN KEY (protocol_item_id) REFERENCES protocol_items(id) ON DELETE CASCADE;

-- Revisão do usuário: impede duas linhas de progresso para o mesmo item na
-- mesma atribuição (hoje não há nada no banco impedindo isso — só a lógica
-- de aplicação em /api/patient/protocol-progress, que já checa "existing"
-- antes de marcar, mas sem garantia no nível do banco).
ALTER TABLE protocol_progress
  ADD CONSTRAINT protocol_progress_assignment_item_unique
  UNIQUE (assignment_id, protocol_item_id);
```

Hoje essa coluna existe mas nunca teve uma constraint de FK de verdade — corrigido junto, já que estamos redesenhando `protocol_items` de qualquer forma. A `UNIQUE` é nova e fecha uma lacuna que a rota já pressupõe estar fechada, mas que hoje só é garantida pela ordem de operações do código, não pelo banco.

**Nota para o futuro (levantada na revisão, não muda o design atual).** Esta `UNIQUE` assume "1 conclusão por item por atribuição", que é exatamente o comportamento de hoje (marcar/desmarcar, nunca duas conclusões do mesmo item). Se algum dia existir "refazer atividade" (múltiplas execuções do mesmo item, ex. um exercício repetido no mesmo dia), essa constraint precisaria evoluir — por exemplo para `UNIQUE (assignment_id, protocol_item_id, attempt_number)` ou incorporar `completed_at`/`checkin_date` na chave. Não é uma necessidade hoje; registrado aqui para quando (e se) essa funcionalidade for cogitada, em vez de descobrir a restrição da forma difícil.

### 2.6 RLS — reescrita obrigatória para `protocol_days`/`protocol_items`

A política atual (`USING (true)` para SELECT, nenhuma política de escrita) permite que **qualquer paciente autenticada de qualquer tenant leia o conteúdo de protocolo de qualquer outro tenant**, e bloqueia toda escrita não-service-role (Achado 0.2). Nova política, no mesmo padrão já usado em toda a Biblioteca Clínica:

```sql
-- Leitura: paciente do tenant, só de protocolos ativos do próprio tenant
CREATE POLICY "Tenant patients can read active protocol content"
  ON protocol_days FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_days.tenant_id));
-- (idem para protocol_items)

-- Escrita: só admin/nutricionista do próprio tenant
CREATE POLICY "Admin manages own protocol_days"
  ON protocol_days FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = protocol_days.tenant_id AND profiles.role IN ('admin','nutritionist')));
-- (idem para protocol_items)
```

Isso fecha o vazamento cross-tenant de leitura e, ao mesmo tempo, corrige o bug de escrita silenciosa do Achado 0.2 — sem essa política de `ALL` para admin, a nova tela de Protocolos (Seção 9, PR2) teria exatamente o mesmo problema que os Sazonais têm hoje.

**Nota adicional (revisão do usuário):** corrigir a política de RLS resolve a causa raiz do Achado 0.2, mas não resolve o hábito de código que a mascarou por tanto tempo. `app/api/admin/seasonal-protocols/route.ts` hoje ignora o erro do insert de `protocol_days` (`if (dayError) continue`) e nem verifica o erro do insert de `protocol_items`. Mesmo com a RLS corrigida, o PR de implementação (Seção 9, PR1) deve parar de engolir essas exceções — qualquer falha futura (violação do novo CHECK, FK inválida, etc.) precisa aparecer para quem está debugando, não desaparecer silenciosamente de novo.

### 2.7 Decisões arquiteturais explícitas (não são efeitos colaterais)

Duas escolhas deste documento têm consequência real em produção e merecem ser lidas como **decisão consciente**, não como detalhe implícito de implementação.

**`tenant_id` denormalizado em `protocol_days` e `protocol_items` é proposital.** Tecnicamente, `tenant_id` já é alcançável por join (`protocol_items → protocol_days → protocols → tenant_id`) — repeti-lo em cada tabela é redundância de dado. A decisão de denormalizar mesmo assim é a mesma já tomada para toda a Biblioteca Clínica na Sub-fase 2: RLS que depende de um join de 2-3 níveis (`EXISTS (... JOIN protocol_days ON ... JOIN protocols ON ...)`) fica mais lenta e mais fácil de errar (um join esquecido nessa cadeia reabre exatamente o vazamento cross-tenant do Achado 0.2) do que uma política que compara `tenant_id` direto na própria linha. O custo é 2 colunas a mais e a obrigação de manter esse valor sincronizado no momento do insert (nunca muda depois, já que um dia/item não migra de protocolo) — trade-off aceito conscientemente em favor de RLS simples e correta.

**Ativos Clínicos são referenciados "ao vivo", sem versionamento — isso é uma decisão arquitetural, não uma limitação esquecida.** Cenário concreto trazido na revisão: uma paciente está no Dia 5 de um protocolo; a nutricionista edita a receita referenciada no Dia 3 (que a paciente já cumpriu) ou no Dia 7 (que ela ainda vai ver); como `protocol_items.recipe_id` é uma referência viva (sem snapshot), a paciente passa a ver a versão atual da receita em qualquer dia ainda não renderizado/cumprido, inclusive dias já cumpridos se a tela de histórico re-consultar o mestre em vez de guardar o que foi mostrado. Isso **já é o comportamento de hoje** (tanto `protocols.content` quanto a Biblioteca Clínica em geral não têm snapshot), mas a Sub-fase 3 o formaliza como o modelo definitivo de todo protocolo, então fica documentado aqui como escolha deliberada: **esta arquitetura assume referências "ao vivo" — alterar um Ativo Clínico impacta todos os protocolos (e, futuramente, dietas) que o referenciam, retroativamente, sem aviso.** Se isso se tornar um problema real de uso (nutricionista editando receitas de protocolos em andamento com frequência), a resposta é o `protocol_versions` esboçado na Seção 6 — não implementado agora, mas o risco está registrado como decisão, não como descuido.

### 2.8 Estratégia de migração segura para o PR1 (checklist de execução, não mudança de arquitetura)

Validação pedida pelo usuário antes de iniciar o PR1 — quatro pontos, todos sobre **como** aplicar a migração da Seção 2 com segurança, não sobre o desenho em si.

**1. 100% aditiva.** O PR1 não remove nenhuma coluna. `protocol_items.type`/`.ingredients`/`.recipe` continuam existindo (removidas só no PR4); `protocols.content` continua existindo e sendo o que `ProtocolsView.tsx` lê/escreve até o PR2 trocar isso. Nenhum código atual quebra entre o merge do PR1 e o do PR2.

**2. Novas FKs em `protocol_items` nullable desde o início.** Já é o próprio desenho da Seção 2.3 — `recipe_id`/`meal_id`/`shot_id`/`tea_id`/`supplement_id`/`material_id` são nullable por definição (é isso que viabiliza `item_kind='custom'`). Nenhuma delas vira `NOT NULL` em momento algum desta sub-fase.

**3. Ordem de operações para o `CHECK` não invalidar as 14 linhas legadas órfãs — risco real encontrado e corrigido.** A Seção 2.3 originalmente tinha `item_kind DEFAULT 'clinical_asset'`. Isso quebraria a própria migração: as 14 linhas de `protocol_items` já existentes (órfãs, ver Achado 0.3) não têm nenhuma das 6 novas FKs preenchida (são colunas novas, nascem `NULL`) — se essas linhas herdassem `item_kind='clinical_asset'` por default, o `CHECK` (que exige exatamente 1 FK preenchida para esse valor) rejeitaria a própria migração ao tentar validar as linhas existentes. **Corrigido:** o `DEFAULT` da coluna passou a ser `'custom'` (já ajustado na Seção 2.3), que é o único valor compatível com 0 FKs preenchidas — exatamente o estado de qualquer linha legada. Ordem de execução dentro do PR1:

```sql
-- a) novas colunas, sem CHECK ainda
ALTER TABLE protocol_items ADD COLUMN item_kind text NOT NULL DEFAULT 'custom';
ALTER TABLE protocol_items ADD COLUMN recipe_id uuid REFERENCES recipes(id);
-- ... demais 5 FKs, todas nullable, sem dado (colunas novas)

-- b) só então o CHECK, com todas as linhas já em um estado consistente
ALTER TABLE protocol_items ADD CONSTRAINT protocol_items_kind_check CHECK (
  (item_kind = 'custom'         AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 0)
  OR
  (item_kind = 'clinical_asset' AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 1)
);
```
A aplicação (PR2) segue livre para gravar `item_kind='clinical_asset'` explicitamente sempre que popular uma FK — o `DEFAULT 'custom'` só protege o backfill desta migração, não é o valor "normal" esperado em uso real.

**4. Backfill de `tenant_id` — o passo mais sensível, com um risco concreto identificado agora.**

`protocol_days.tenant_id` é backfillável sem ambiguidade: `protocol_days.protocol_id` é `NOT NULL` com FK válida para `protocols`, então todo `protocol_day` tem um `protocols.tenant_id` para copiar.
```sql
UPDATE protocol_days pd SET tenant_id = p.tenant_id FROM protocols p WHERE p.id = pd.protocol_id;
```

`protocol_items.tenant_id` tem um problema real: o backfill natural (`UPDATE protocol_items pi SET tenant_id = pd.tenant_id FROM protocol_days pd WHERE pd.id = pi.protocol_day_id`) **não alcança as 14 linhas órfãs conhecidas**, porque `protocol_day_id` delas não bate com nenhum `protocol_days.id` existente — não há linha para o join casar, então `tenant_id` ficaria `NULL` nelas, e o `ALTER COLUMN ... SET NOT NULL` subsequente falharia.

**Resolução:** como parte do PR1, após reconfirmar a contagem fresca (Achado 0.3), se essas linhas continuarem órfãs, elas são **excluídas antes do backfill**:
```sql
DELETE FROM protocol_items WHERE protocol_day_id NOT IN (SELECT id FROM protocol_days);
```
Justificativa: essas linhas já são comprovadamente não-funcionais hoje — não aparecem em nenhuma tela (não há `protocol_days` válido para alcançá-las a partir de nenhum protocolo real) e não há forma correta de atribuir um `tenant_id` a uma linha sem um dia de protocolo válido. Mantê-las não preserva nenhum dado real, só impediria o `NOT NULL`. Se a contagem fresca mostrar algo diferente das 14 órfãs já conhecidas, este passo é revisado antes de aplicar — não é uma exclusão automática cega.

Só depois desse delete + backfill limpo, `tenant_id` vira `NOT NULL` nas duas tabelas.

**Disciplina de execução (revisão do usuário): validar antes de cada passo irreversível, nunca "corrigir durante".** Antes de qualquer `SET NOT NULL`, `ADD CONSTRAINT ... CHECK` ou `ADD CONSTRAINT ... FOREIGN KEY` desta migração, rodar a consulta de validação correspondente e **interromper a migração se ela não retornar zero** — não tentar consertar dado no meio da execução:

```sql
-- antes de tenant_id NOT NULL (protocol_days)
SELECT count(*) FROM protocol_days WHERE tenant_id IS NULL;                    -- deve ser 0

-- antes de tenant_id NOT NULL (protocol_items)
SELECT count(*) FROM protocol_items WHERE tenant_id IS NULL;                   -- deve ser 0

-- antes do CHECK de item_kind/FKs
SELECT count(*) FROM protocol_items
WHERE NOT (
  (item_kind = 'custom'         AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 0)
  OR
  (item_kind = 'clinical_asset' AND num_nonnulls(recipe_id, meal_id, shot_id, tea_id, supplement_id, material_id) = 1)
);                                                                              -- deve ser 0

-- antes da FK de protocol_progress.protocol_item_id
SELECT count(*) FROM protocol_progress pp
WHERE NOT EXISTS (SELECT 1 FROM protocol_items pi WHERE pi.id = pp.protocol_item_id);  -- deve ser 0

-- antes da UNIQUE(assignment_id, protocol_item_id) em protocol_progress
SELECT assignment_id, protocol_item_id, count(*)
FROM protocol_progress GROUP BY 1, 2 HAVING count(*) > 1;                      -- deve retornar 0 linhas

-- antes da UNIQUE(protocol_id, day_number) em protocol_days
SELECT protocol_id, day_number, count(*)
FROM protocol_days GROUP BY 1, 2 HAVING count(*) > 1;                          -- deve retornar 0 linhas
```

Qualquer uma dessas consultas retornando diferente de zero **para a migração**, sem tentar contornar no mesmo script — a causa é investigada e a Seção 2.8 (ou a contagem de produção do Achado 0.3) é revisada antes de tentar de novo. Isso mantém o processo previsível e o rollback simples (nada de estado parcialmente corrigido no meio de uma transação).

---

## 3. Modelagem de `Protocol Item` — comparação de alternativas

Esta é a decisão de modelagem mais importante da sub-fase, porque `protocol_items` é a tabela mais consultada do sistema (todo carregamento da Home da paciente passa por ela).

**Nota de terminologia (revisão do usuário):** a versão anterior deste documento chamava a Alternativa A de "referência polimórfica". Isso é impreciso — polimorfismo, no sentido de banco de dados, normalmente descreve uma FK genérica (`entity_type` + `entity_id`), que **não** é o que está sendo proposto aqui e resolveria a integridade referencial de forma muito mais fraca (o banco não consegue validar `entity_id` contra múltiplas tabelas possíveis). O nome correto do que a Alternativa A realmente é: **nullable foreign keys mutuamente exclusivas** — uma coluna de FK de verdade por tipo, cada uma validável pelo banco, com no máximo uma preenchida por linha. Renomeado abaixo para evitar essa confusão.

### Alternativa A — Nullable foreign keys mutuamente exclusivas (colunas de FK nulas na própria tabela)

Uma coluna de FK nullable por tipo de Ativo Clínico na própria `protocol_items`, com um discriminador explícito (`item_kind`, Seção 2.3) e `CHECK` amarrando `item_kind` à contagem de FKs preenchidas. É exatamente o padrão já usado e aprovado em `shot_components`/`tea_components`/`meal_components`/`recipe_components` (Sub-fase 2), estendido de "componente de uma receita" para "item de um dia de protocolo".

### Alternativa B — Tabela de junção por tipo

Uma tabela por tipo de ativo: `protocol_recipe_items`, `protocol_meal_items`, `protocol_shot_items`, etc. (6 tabelas), cada uma com FK `NOT NULL` para seu tipo específico.

### Alternativa C — Supertipo/Subtipo

`protocol_items` guarda só os campos comuns de agendamento (dia, hora, pontos, ordem), sem nenhuma FK de ativo. Uma tabela filha 1:1 por tipo (`protocol_item_recipe`, `protocol_item_shot`, ...) guarda a FK e campos específicos do tipo, referenciando `protocol_items.id`.

### Comparação

| Critério | A — Nullable FKs mutuamente exclusivas | B — Junção por tipo | C — Supertipo/Subtipo |
|---|---|---|---|
| Renderizar 1 dia inteiro (a consulta mais frequente do sistema) | 1 query, `ORDER BY order_index` | `UNION ALL` de 6 tabelas ou 6 queries | `LEFT JOIN` com até 6 tabelas filhas |
| Suporte a "item livre" (água, exercício, sem Ativo Clínico) | Grátis — `item_kind='custom'`, todas as FKs nulas | Precisa de uma 7ª tabela `protocol_custom_items` | Precisa de uma 7ª subtabela ou de nulos na supertabela mesmo assim |
| Adicionar um tipo de ativo novo no futuro | 1 `ALTER TABLE ADD COLUMN` + 1 cláusula no CHECK | 1 tabela nova + reescrever toda consulta de listagem | 1 tabela filha nova, mesma reescrita de consulta |
| Consistência com o que já foi construído (Sub-fase 2) | Idêntico ao padrão já revisado e aprovado | Diferente sem motivo — mesmo domínio, modelagem distinta | Diferente sem motivo |
| Pureza normalizada (3NF) | Colunas majoritariamente nulas (6 colunas, no máx. 1 preenchida) | Total | Quase total (campos comuns ficam limpos) |
| Custo real dado o volume de dados (um protocolo tem ~7-30 dias × ~3-6 itens ≈ 100-200 linhas) | Irrelevante nesse volume | Ganho teórico não paga o custo de leitura | Ganho teórico não paga o custo de leitura |

### Decisão: Alternativa A

A pureza normalizada de B/C é real, mas o domínio aqui não tem volume que justifique o custo: nenhum protocolo terá dezenas de milhares de itens. A consulta que mais importa — "traga o dia de hoje, ordenado" — é executada a cada carregamento da Home da paciente, e a Alternativa A resolve isso com uma única query sem join extra. Além disso, adotar B ou C introduziria uma segunda forma de modelar "referência a Ativo Clínico" no mesmo código-base que já resolveu esse exato problema (composição de receita/shot/chá/refeição) do jeito A na Sub-fase 2 — inconsistência sem ganho real. Alternativa A também resolve "item sem Ativo Clínico" (água, exercício livre) de graça, com `item_kind='custom'` explícito em vez de precisar de uma 7ª tabela só para isso, o que está alinhado com ADR-0004 (nem tudo precisa virar um Ativo Clínico só para poder existir como item de protocolo).

---

## 4. Fluxo clínico (sem telas — só o fluxo)

```
1. Criar Protocolo
   → título, duração, categoria, (opcional) fase do método
2. Adicionar Dias
   → um dia por vez, ou os N dias de uma vez (duração define o esqueleto)
3. Adicionar Itens a um dia
   → para cada item: "Selecionar da Biblioteca Clínica" (recipe/meal/shot/tea/
     supplement/material — reaproveita os pickers já existentes na
     ClinicalLibraryView, item_kind='clinical_asset') OU "Item personalizado"
     (água, exercício livre — sem Ativo Clínico, item_kind='custom', só texto).
     Metas não aparecem aqui — elas se ligam ao protocolo inteiro no passo 4,
     nunca a um item de um dia específico
   → se um Ativo foi referenciado: opcionalmente sobrescrever título/descrição/
     quantidade só para esta ocorrência (ADR-0003)
4. Selecionar Metas do protocolo (opcional)
   → multi-select de Metas já existentes na Biblioteca Clínica (protocol_goals)
5. Salvar
   → grava em protocols + protocol_days + protocol_items + protocol_goals
6. Atribuir ao paciente
   → fluxo já existente (protocol_assignments), inalterado
```

Ponto importante decorrente do ADR-0004: se, no passo 3, faltar o Ativo Clínico desejado (ex. a receita ainda não existe), o fluxo correto é ir até a Biblioteca Clínica cadastrá-lo lá — nunca um atalho de criação embutido na tela de Protocolo.

---

## 5. Registro Mestre × Instância — exemplos práticos (aplicação do ADR-0003)

**Protocolo usando uma receita:**
```
protocol_items: { recipe_id: <"Omelete de Claras">, time: '07:00' }
```
Título/descrição exibidos vêm de `recipes.title`/`recipes.description` (join). Nenhuma cópia.

**Protocolo usando um suplemento, com observação específica desta prescrição:**
```
protocol_items: { supplement_id: <"Ômega 3">, quantity: 1000, unit: 'mg',
                  title: 'Tomar junto com o almoço' }
```
`title` aqui é o **override de instância**: a nutricionista quer uma nota específica para esta prescrição, sem alterar o registro mestre do suplemento (que continua sem essa nota para qualquer outro protocolo que o referencie).

**Protocolo usando uma refeição composta:**
```
protocol_items: { meal_id: <"Café da manhã proteico">, time: '07:30' }
```
Sem overrides — a composição (`meal_components`) já vive inteira na Biblioteca Clínica; o protocolo só agenda "esta refeição, neste horário".

**Customização sem alterar o registro mestre:**
A nutricionista quer o dobro da porção de "Omelete de Claras" só para a paciente X, só neste protocolo. Ela **não edita `recipes`** — edita `protocol_items.quantity` daquela linha específica. Qualquer outro protocolo ou dieta que referencie a mesma receita mantém sua própria porção, intocada. Isso é exatamente o padrão que `meal_plan_items` (Dietas) já usa hoje com `food_id` + `substitution_note`, citado como precedente no próprio ADR-0003.

---

## 6. Evolução futura — a arquitetura precisa suportar, sem implementar agora

**Copiar protocolos.** A RPC `duplicate_protocol` já existe (criada antes desta sub-fase, hoje órfã e desatualizada). Como `protocol_items` só referencia Ativos Clínicos (nunca copia conteúdo), duplicar um protocolo é barato e seguro: a cópia aponta para as mesmas receitas/shots/refeições do original, sem risco de divergência de conteúdo. A Sub-fase 3 atualiza essa RPC para o novo conjunto de colunas e inclui `protocol_goals` na cópia (Seção 9).

**Versionar protocolos.** Não implementado agora — é a mesma limitação já aceita conscientemente no ADR-0003 (referência sempre "ao vivo", sem snapshot): editar um protocolo depois que uma paciente já começou muda o que ela vê retroativamente. Isso não é um risco novo introduzido por esta sub-fase — é o comportamento que `protocols.content` já tinha desde sempre, agora só formalizado. Se um dia for necessário, o caminho seria uma tabela `protocol_versions` + `protocol_assignments.protocol_version_id` gravando qual versão a paciente realmente viu — desenhável depois, sem exigir remodelar o que está sendo proposto aqui.

**Montagem automática por protocolo via IA.** Hoje `/api/ai/generate` (task `generate-protocol`) devolve JSON livre gravado direto em `protocols.content`. Com `protocol_items` referenciando Ativos Clínicos reais, o caminho natural (não implementado agora) é: a IA recebe um tema/objetivo clínico, busca Ativos existentes por `tags`/`category_id` (já indexado desde a Sub-fase 2), e propõe um cronograma dia-a-dia como linhas de `protocol_items` apontando para IDs reais — a nutricionista revisa antes de salvar. Mesmo formato de UX que os botões "Gerar com IA" já existentes na Biblioteca Clínica, reaplicado uma camada acima.

**Compartilhamento entre tenants / marketplace.** `protocols.is_public` já existe no schema desde antes desta sub-fase (sempre gravado como `false`, nunca lido em nenhum lugar do código hoje — confirmado por busca). Como `protocol_items` nunca copia conteúdo (só referencia), duplicar um protocolo "público" para outro tenant exigiria remapear cada FK (`recipe_id`, `shot_id`, etc.) para o equivalente do tenant de destino, já que Ativos Clínicos são tenant-scoped — um passo mecânico real, não desenhado aqui, mas que a separação "cronograma" (`protocol_items`) vs. "conteúdo" (Biblioteca Clínica) deixa possível sem redesenho estrutural.

**Protocolos públicos e privados.** Mesma coluna `is_public`, combinada com a máquina que os Protocolos Sazonais já construíram para venda avulsa (`is_standalone`, `standalone_slug`, `protocol_leads`) — um "protocolo público" (preview sem paywall) é arquiteturalmente a mesma forma que a página de vendas avulsa de hoje, só sem a cobrança. Nenhuma tabela nova necessária, só uma decisão de leitura para quando for priorizado.

---

## 7. Escalabilidade — resposta direta

**Pergunta:** existe alguma decisão desta Sub-fase 3 que exigiria remodelagem estrutural nas Sub-fases 4, 5 ou 6?

**Resposta: sim, uma — e ela já está corrigida neste próprio documento, não deixada para depois.** Sem `protocols.method_phase_id`, a Sub-fase 6 (Paciente → Método → Fase → Protocolo) precisaria voltar e alterar a tabela `protocols` de novo para linká-la à fase da jornada. Por isso essa coluna já está incluída no design da Seção 2.1 desta sub-fase, mesmo sem nenhuma tela ainda usando-a — o mesmo raciocínio já usado para preparar campos de IA nullable na Sub-fase 2 antes de qualquer IA realmente escrever neles.

Nenhuma outra dependência de rework foi identificada:
- **Sub-fase 4 (Dietas)** não compartilha nenhuma tabela nova desta sub-fase — `meal_plan_items` já segue seu próprio padrão de referência (`food_id` + override), independente de `protocol_items`.
- **Sub-fase 5 (Metas e Desafios)** usará `challenge_goals` (challenge↔goal), um conceito irmão de `protocol_goals` (protocol↔goal), não dependente dele — os dois convivem sem conflito, cada um ligando `goals` a um contexto diferente.
- A questão de versionamento (Seção 6) é uma limitação aceita transitivamente do ADR-0003, não uma decisão nova desta sub-fase — não é "dívida criada aqui", é dívida pré-existente apenas confirmada.

---

## 8. Diagramas

### 8.1 Modelo conceitual

```mermaid
flowchart TD
    A[Método] --> B[Fase]
    B --> C[Protocolo]
    C --> D[Dia do Protocolo]
    D --> E["Item do Protocolo (item_kind)"]
    E -.referencia no máx 1.-> F[Ativo Clínico agendável]
    F --> F1[Receita]
    F --> F2[Refeição]
    F --> F3[Shot]
    F --> F4[Chá]
    F --> F5[Suplemento]
    F --> F6[Material]
    C -.declara foco em via protocol_goals.-> F7[Meta]
```

Nota: Meta (`F7`) só se liga ao Protocolo como um todo (`protocol_goals`) — nunca a um Item individual. É a única entidade da Biblioteca Clínica que não aparece como possível referência de `protocol_items`, por não fazer sentido agendada num dia/hora (Seção 2.3/2.4).

### 8.2 Modelo relacional (ER)

```mermaid
erDiagram
    METHODS ||--o{ METHOD_PHASES : possui
    METHOD_PHASES ||--o{ PROTOCOLS : "classifica (nullable)"
    PROTOCOLS ||--o{ PROTOCOL_DAYS : possui
    PROTOCOL_DAYS ||--o{ PROTOCOL_ITEMS : possui
    PROTOCOLS ||--o{ PROTOCOL_GOALS : declara
    GOALS ||--o{ PROTOCOL_GOALS : "referenciada por"
    PROTOCOLS ||--o{ PROTOCOL_ASSIGNMENTS : atribuido_a
    PROTOCOL_ASSIGNMENTS ||--o{ PROTOCOL_PROGRESS : gera
    PROTOCOL_ITEMS ||--o{ PROTOCOL_PROGRESS : "concluido via"

    PROTOCOL_ITEMS }o--o| RECIPES : "referencia (0 ou 1 destas 6, conforme item_kind)"
    PROTOCOL_ITEMS }o--o| MEALS : referencia
    PROTOCOL_ITEMS }o--o| SHOTS : referencia
    PROTOCOL_ITEMS }o--o| TEAS : referencia
    PROTOCOL_ITEMS }o--o| SUPPLEMENTS : referencia
    PROTOCOL_ITEMS }o--o| MATERIALS : referencia

    PROTOCOLS {
        uuid id PK
        uuid tenant_id FK
        uuid method_phase_id FK "nullable, novo"
        text title
        text category
        jsonb shopping_list
        text_array sales_goals "renomeada de goals"
        boolean is_public
        boolean is_standalone
    }
    PROTOCOL_DAYS {
        uuid id PK
        uuid protocol_id FK
        uuid tenant_id FK "novo"
        int day_number
        text title
    }
    PROTOCOL_ITEMS {
        uuid id PK
        uuid protocol_day_id FK
        uuid tenant_id FK "novo"
        text item_kind "clinical_asset ou custom, novo"
        uuid recipe_id FK "nullable"
        uuid meal_id FK "nullable"
        uuid shot_id FK "nullable"
        uuid tea_id FK "nullable"
        uuid supplement_id FK "nullable"
        uuid material_id FK "nullable"
        text title "override ou item livre"
        numeric quantity
        int points
    }
    PROTOCOL_GOALS {
        uuid id PK
        uuid protocol_id FK
        uuid goal_id FK
        int sort_order
    }
    PROTOCOL_ASSIGNMENTS {
        uuid id PK
        uuid protocol_id FK
        uuid user_id FK
        text status
    }
    PROTOCOL_PROGRESS {
        uuid id PK
        uuid assignment_id FK
        uuid protocol_item_id FK "FK real, novo; UNIQUE com assignment_id, novo"
        text proof_type
    }
```

### 8.3 Fluxo de uso

```mermaid
flowchart LR
    A[Criar Protocolo] --> B[Adicionar Dias]
    B --> C[Adicionar Itens]
    C --> D{Selecionar origem}
    D -->|Ativo da Biblioteca, item_kind=clinical_asset| E[Buscar em recipes/meals/shots/teas/supplements/materials]
    D -->|Item personalizado, item_kind=custom| F[Título/descrição livres]
    E --> G[Opcional: override de instância]
    F --> H[Salvar item]
    G --> H
    H --> I[Selecionar Metas do protocolo]
    I --> J[Salvar Protocolo]
    J --> K[Atribuir ao Paciente]
```

---

## 9. Plano de implementação (PRs pequenas e revisáveis)

Mesma técnica já usada com sucesso na Sub-fase 2 (aditivo → cutover → limpeza), para nunca deixar o app quebrado entre merges.

**PR 1 — Fundação de schema (aditivo, corrige o bug do Achado 0.2 — inclui um pequeno ajuste de código, não é só banco)**
- Seguir exatamente a ordem de operações da Seção 2.8: reconfirmar contagens (Achado 0.3) → excluir as linhas órfãs de `protocol_items` se ainda existirem → adicionar colunas novas (nullable) → backfill de `tenant_id` → `item_kind`/FKs → `CHECK` → só então `tenant_id NOT NULL`.
- `tenant_id` em `protocol_days`/`protocol_items` (backfill antes de `NOT NULL`, Seção 2.8) + reescrita de RLS (leitura tenant-scoped, escrita admin) — sozinho, já conserta a escrita silenciosamente quebrada dos Protocolos Sazonais.
- `item_kind` (`clinical_asset`/`custom`, `DEFAULT 'custom'`) + 6 FKs nullable (sem `goal_id`) + `quantity`/`unit`/`serving_label` em `protocol_items`, com o CHECK forte amarrando `item_kind` à contagem de FKs preenchidas, adicionado só depois do backfill (Seção 2.3/2.8) — **aditivo** (colunas antigas `type`/`ingredients`/`recipe` continuam existindo por enquanto).
- `UNIQUE(protocol_id, day_number)` em `protocol_days`.
- FK real + `UNIQUE(assignment_id, protocol_item_id)` em `protocol_progress`.
- `protocols.method_phase_id` (nullable).
- Tabela `protocol_goals` + RLS (única ligação de Metas a protocolo — nada em `protocol_items`).
- Correção pontual em `app/api/admin/seasonal-protocols/route.ts`: parar de ignorar o erro do insert de `protocol_days`/`protocol_items` (hoje `if (dayError) continue` e nenhuma checagem no insert de items) — sem isso, mesmo com a RLS corrigida, uma falha futura (violação do novo CHECK, por exemplo) voltaria a desaparecer silenciosamente.
- Teste: aplicar migração, `get_advisors`, teste manual de que o POST de Sazonais agora realmente persiste dias/itens e que um erro proposital (ex. CHECK violado) aparece de forma visível.

**PR 2 — Novo builder de Protocolos consumindo a Biblioteca Clínica**
- Revive/adapta `useProtocolBuilder.ts` (ou hook novo) para escrever nas colunas novas.
- Reescreve o editor de dia/item em `ProtocolsView.tsx`: por item, escolher "Ativo da Biblioteca" (reaproveitando os pickers já existentes) ou "Item personalizado".
- UI de seleção de Metas do protocolo (`protocol_goals`).
- Protocolo passa a salvar em `protocol_days`/`protocol_items`/`protocol_goals`; `content` jsonb para de receber escrita nova (mas continua existindo até o PR4).

**PR 3 — Cutover do app da paciente**
- `usePatientEngine.ts` resolve título/descrição via join com o Ativo referenciado (fallback para `protocol_items.title/description` quando é item livre).
- Confirmar que a página pública de Protocolo Sazonal (`/oferta/[slug]`) renderiza corretamente a partir do novo formato de item.

**PR 4 — Migração dos dados legados + limpeza**
- Migrar as (poucas) linhas existentes de `protocols.content` para `protocol_days`/`protocol_items` reais (revisão manual antes do merge, já que é o único conteúdo real em jogo).
- Drop de `protocols.content`, `protocol_items.type`/`.ingredients`/`.recipe`.
- Rename `protocols.goals` → `sales_goals` (+ ajuste dos pontos que o leem/escrevem).
- Remoção do fallback morto `content_json` em `useDatabase.ts`/`ProtocolsView.tsx` (nunca foi uma coluna real).
- Atualização da RPC `duplicate_protocol` para o novo conjunto de colunas + `protocol_goals`; ligar como o botão "Duplicar" real na tela.

**PR 5 (opcional, não bloqueia Sub-fase 4/5/6) — Montagem de protocolo assistida por IA sobre a Biblioteca Clínica**
- Busca de Ativos por tema/tags e proposta de cronograma referenciando IDs reais, para revisão da nutricionista antes de salvar.

Cada PR é revisável isoladamente e nenhuma delas deixa o app em estado quebrado entre merges — a mesma garantia que a Sub-fase 2 já demonstrou funcionar bem na prática.

---

## Referências

- ADR-0001 (camadas da arquitetura)
- ADR-0002 (contrato de Ativos Clínicos)
- ADR-0003 (Registro Mestre e Instância — aplicado extensivamente neste documento)
- ADR-0004 (consumir, não criar)
- PR #40 (Sub-fase 1), PR #43 (Sub-fase 2)
