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
status        text not null default 'active' check (status in ('active','inactive'))
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

(Colunas específicas de cada entidade — `ingredients`/`instructions` em `recipes`, `energy_kcal` em `foods`, etc. — continuam existindo além deste conjunto comum.)

No TypeScript, cada hook/tipo de entidade estende uma interface compartilhada:

```typescript
// lib/types/clinicalAsset.ts
export interface BaseClinicalEntity {
    id: string
    tenant_id: string
    title: string
    description: string | null
    status: 'active' | 'inactive'
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

RLS de todas essas tabelas segue o mesmo padrão já usado em `recipes` (admin gerencia via `profiles` + `role in ('admin','nutritionist')`; paciente lê linhas com `status = 'active'` do seu tenant).

**Retrofit em tabelas existentes:** `recipes` (já existe desde antes desta reforma) recebe as colunas do contrato que ainda não tem (`status` — hoje usa `is_active boolean`, decisão de migração a avaliar na Sub-fase 2 se convertida ou mantida com um mapeamento —, `ai_summary`, `ai_keywords`, `indications`, `contraindications`, `sort_order`, `created_by`) via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, sem quebrar o que já existe. `goals` recebe o mesmo tratamento.

## Consequências

**Positivas:**
- APIs, hooks e componentes de formulário para "Ativo Clínico" podem compartilhar lógica genérica (ex.: um componente de tag picker, um componente de upload de imagem, um bloco de campos de IA) reutilizável entre `RecipesView`, `SupplementsView`, `ShotsView` etc., em vez de reimplementar por tela.
- Nenhuma entidade nova exige migração estrutural futura só para ganhar tags ou campos de IA — já nascem prontos, mesmo vazios.

**Custos:**
- Tabelas carregam colunas que podem ficar não usadas por um bom tempo em algumas entidades (ex.: `contraindications` em `materials` pode nunca ser preenchido) — aceitável, é o trade-off deliberado de "padronizar desde o nascimento" em vez de acumular migrações incrementais depois.
- `status` como `text` com CHECK em vez do `is_active boolean` que `recipes`/`goals` já usam hoje é uma pequena divergência a resolver explicitamente na implementação da Sub-fase 2 (decisão: manter `is_active boolean` nas tabelas existentes por compatibilidade, ou converter tudo para `status text`, uniformizando). Fica registrado aqui para não ser esquecido — não decidido neste ADR.

## Referências

- ADR-0001 (camadas da arquitetura e fonte única de verdade)
- PR #40 (Sub-fase 1 — Fundação da arquitetura)
