# ADR-0001: Camadas da Arquitetura de Método Clínico e Fonte Única de Verdade

**Status:** Aceita
**Data:** 2026-07-21
**Contexto da decisão:** Sub-fase 1 da evolução arquitetural "Método Clínico" (PR #40)

## Contexto

Antes desta evolução, o sistema tratava **Protocolo** como unidade central: cada protocolo carregava seu próprio conteúdo embutido (receitas, shots, tarefas em `content`/`content_json`), e a "fase da paciente" era um número fixo de 1 a 6 (`fase_paciente.fase`) com nomes hardcoded em código (`lib/config/mensagensNotificacao.ts`). Essa modelagem misturava dois conceitos diferentes — **etapa da jornada** (ex.: "Organizando a Morada") e **tipo de intervenção clínica** (ex.: "Protocolo Anti-inflamatório") — e não permitia reaproveitar conteúdo (uma receita ou meta) entre protocolos, dietas e desafios sem duplicação.

A Sub-fase 1 introduziu `methods`/`method_phases` como fundação de uma hierarquia normalizada. Sem uma regra explícita sobre onde nova funcionalidade deve viver, o risco natural — em qualquer projeto em evolução — é alguém criar uma tabela paralela por conveniência (`protocol_recipes_v2`, `meal_templates`, etc.) meses depois, reintroduzindo a mesma duplicação que esta reforma existe para eliminar.

## Decisão

Toda nova funcionalidade do domínio clínico/nutricional deve se encaixar em uma destas camadas:

1. **Método** — o método clínico da nutricionista (`methods`)
2. **Fase** — etapa da jornada da paciente dentro de um método (`method_phases`)
3. **Protocolo** — estratégia/intervenção clínica aplicada dentro de uma fase (`protocols`)
4. **Ativo Clínico** — receitas, alimentos, refeições, shots, chás, suplementos, materiais (`recipes`, `foods`, `meals`, `shots`, `teas`, `supplements`, `materials`) — coletivamente organizados pela **Biblioteca Clínica**, que é uma camada de apresentação, não uma tabela própria
5. **Dieta** — plano alimentar consumindo Ativos Clínicos (`meal_plans`)
6. **Meta** — objetivo/hábito reutilizável e independente (`goals`)
7. **Desafio** — agrupador de metas com gamificação (`challenges` + `challenge_goals`)
8. **Paciente** — jornada da paciente através de Método → Fase → Protocolo → Dieta → Metas/Desafios (`profiles`, `fase_paciente`, `protocol_assignments`, `meal_plan_assignments`)

**Regras:**

- Nenhuma funcionalidade nova deve criar uma camada paralela às oito acima sem justificativa arquitetural explícita registrada em um novo ADR.
- Sempre que um conteúdo puder ser reutilizado por mais de uma entidade (ex.: uma receita usada em múltiplos protocolos, uma meta usada em múltiplos desafios), deve existir **apenas uma fonte de verdade** — as demais entidades **referenciam** via relacionamento (FK), nunca duplicam o conteúdo em JSON ou coluna própria.
- Antes de criar uma tabela nova, verificar se o conceito já se encaixa em uma das oito camadas ou em uma tabela existente. Criar uma tabela nova só quando a camada existente genuinamente não representa o conceito.

## Consequências

**Positivas:**
- Uma pergunta objetiva para qualquer decisão de modelagem futura: "em qual das oito camadas isso vive?" — reduz a tentação de atalhos "mais rápidos" que acumulam dívida técnica.
- Conteúdo reaproveitável (receitas, metas, materiais) só precisa ser mantido em um lugar.
- Novas camadas (ex.: Diagnósticos/Objetivos clínicos, previstos para o futuro) são adições deliberadas e documentadas, não acréscimos silenciosos.

**Custos:**
- Exige disciplina: ao planejar uma nova feature, é preciso investir tempo confirmando que ela pertence a uma camada existente antes de implementar.
- Casos de fronteira vão aparecer (ex.: onde vive "Diagnóstico" ou "Objetivo Clínico" quando forem implementados) — a decisão é resolver isso com um novo ADR, não com uma tabela ad-hoc.

## Referências

- PR #40 (Sub-fase 1 — Fundação da arquitetura)
- Issue #41 (rename de `FASES_REINO`, decorrente da separação Fase/Protocolo formalizada aqui)
- `docs/adr/0002-contrato-ativos-clinicos.md` (contrato comum para a camada de Ativo Clínico, Sub-fase 2)
