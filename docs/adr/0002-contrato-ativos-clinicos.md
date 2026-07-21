# ADR-0002: Contrato Comum para Ativos Clínicos

**Status:** Aceita (implementação prevista para a Sub-fase 2)
**Data:** 2026-07-21
**Contexto da decisão:** Planejamento da Sub-fase 2 (Biblioteca Clínica), decorrente do ADR-0001

## Contexto

A camada de **Ativo Clínico** (ADR-0001, item 4) será composta por várias tabelas independentes — `recipes` (já existe), `foods` (já existe), `meals`, `shots`, `teas`, `supplements`, `materials` (novas na Sub-fase 2) — mais `goals` (Metas, já existe, tratada com o mesmo contrato por reutilizar o mesmo tipo de metadado). Sem um contrato comum definido antes de criar essas tabelas, cada uma tende a nascer com pequenas diferenças de coluna, gerando duplicação de código em APIs, hooks, formulários e componentes React para lidar com essas diferenças — exatamente o tipo de inconsistência já corrigida uma vez na Sub-fase 1 (`order_index` vs. `sort_order`).

Postgres/Supabase não usa herança de tabela para este tipo de caso (não é o padrão do projeto, que já usa tabelas independentes com colunas repetidas — ver `recipes`, `goals`, `challenges`). O contrato, portanto, não é uma tabela-base, e sim um **conjunto de colunas obrigatório** replicado em cada tabela nova, mais uma **interface TypeScript compartilhada** no código.

## Decisão

Toda tabela da camada de Ativo Clínico (e `goals`) nasce com este conjunto mínimo de colunas:

```sql
id            uuid primary key default gen_random_uuid()
tenant_id     uuid not null references tenants(id) on delete cascade
title         text not null
description   text
is_active     boolean not null default true
tags          text[] default '{}'
image_url     text
sort_order    integer not null default 0
ai_summary    text
ai_keywords   text[] default '{}'
indications   text
contraindications text
created_by    uuid references auth.users(id)
created_at    timestamptz default now()
updated_at    timestamptz default now()
```

**Decisão sobre `is_active` vs. `status` (resolvida, não fica em aberto para a Sub-fase 2):** o contrato usa `is_active boolean`, não `status text`. Levantamento em `supabase/migrations/*.sql` mostra `is_active boolean` como padrão dominante e já estabelecido (7 migrations, incluindo `recipes`, `goals`, `methods`, `challenges`, `tenants`) — nenhuma migration do projeto usa `status text` para o conceito genérico "este registro está ativo/visível". Os poucos lugares com `status text + CHECK` no projeto (`meal_plans.status`: draft/published/archived; `protocol_assignments.status`: active/completed/paused/cancelled) representam um conceito diferente — **estado de um fluxo de trabalho com mais de duas fases**, não um toggle binário de visibilidade. Ativo Clínico (receita, suplemento, chá etc.) é fundamentalmente "visível ou não" na Biblioteca Clínica — não tem um fluxo de estados intermediários hoje —, então não há ganho arquitetural claro em introduzir `status text` só por uniformidade abstrata. Se uma entidade específica precisar de um fluxo de mais estados no futuro (ex.: "receita gerada por IA pendente de revisão"), isso é decisão local daquela entidade (um campo adicional próprio, seguindo o precedente de `meal_plans.status`), não uma mudança no contrato-base.

(Colunas específicas de cada entidade — `ingredients`/`instructions` em `recipes`, `energy_kcal` em `foods`, etc. — continuam existindo além deste conjunto comum.)

No TypeScript, cada hook/tipo de entidade estende uma interface compartilhada:

```typescript
// lib/types/clinicalAsset.ts
export interface BaseClinicalEntity {
    id: string
    tenant_id: string
    title: string
    description: string | null
    is_active: boolean
    tags: string[]
    image_url: string | null
    sort_order: number
    ai_summary: string | null
    ai_keywords: string[]
    indications: string | null
    contraindications: string | null
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface Recipe extends BaseClinicalEntity { ingredients: any[]; instructions: string; /* ... */ }
export interface Supplement extends BaseClinicalEntity { /* campos específicos */ }
// etc.
```

RLS de todas essas tabelas segue o mesmo padrão já usado em `recipes` (admin gerencia via `profiles` + `role in ('admin','nutritionist')`; paciente lê linhas com `is_active = true` do seu tenant).

**Retrofit em tabelas existentes:** `recipes` e `goals` já usam `is_active boolean` — nenhuma conversão necessária, o contrato confirma o padrão que elas já seguem. Recebem via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` apenas as colunas do contrato que ainda não têm (`ai_summary`, `ai_keywords`, `indications`, `contraindications`, `sort_order`, `created_by`), sem quebrar o que já existe.

## Consequências

**Positivas:**
- APIs, hooks e componentes de formulário para "Ativo Clínico" podem compartilhar lógica genérica (ex.: um componente de tag picker, um componente de upload de imagem, um bloco de campos de IA) reutilizável entre `RecipesView`, `SupplementsView`, `ShotsView` etc., em vez de reimplementar por tela.
- Nenhuma entidade nova exige migração estrutural futura só para ganhar tags ou campos de IA — já nascem prontos, mesmo vazios.

**Custos:**
- Tabelas carregam colunas que podem ficar não usadas por um bom tempo em algumas entidades (ex.: `contraindications` em `materials` pode nunca ser preenchido) — aceitável, é o trade-off deliberado de "padronizar desde o nascimento" em vez de acumular migrações incrementais depois.
- Ao optar por `is_active boolean` em vez de `status text`, o contrato não cobre nativamente estados intermediários (ex.: "em revisão", "arquivado"). Se isso for necessário para uma entidade específica no futuro, a solução é um campo adicional próprio dessa entidade — não uma mudança retroativa no contrato-base.

## Referências

- ADR-0001 (camadas da arquitetura e fonte única de verdade)
- PR #40 (Sub-fase 1 — Fundação da arquitetura)
