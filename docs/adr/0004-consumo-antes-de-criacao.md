# ADR-0004: Consumir Ativos Clínicos existentes antes de permitir criação nova

**Status:** Aceita
**Data:** 2026-07-21
**Contexto da decisão:** Encerramento da Sub-fase 2 (Biblioteca Clínica, PR #43), orientando as Sub-fases 3-6

## Contexto

A Sub-fase 2 consolidou a Biblioteca Clínica como fonte única de verdade para `recipes`, `foods`, `meals`, `shots`, `teas`, `supplements`, `materials` e `goals` (ADR-0001, ADR-0002), com o princípio de referência-nunca-cópia formalizado no ADR-0003. Esse princípio protege o **dado** (nenhuma tabela de instância duplica conteúdo do mestre). Falta proteger o **fluxo de trabalho**: nada impede, por si só, que a Sub-fase 3 (Protocolos), a Sub-fase 4 (Dietas) ou a Sub-fase 5 (Desafios) sejam construídas com uma tela de "criar receita" ou "criar meta" embutida dentro delas — o que reintroduziria, na prática, exatamente a fragmentação que a Biblioteca Clínica existe para eliminar, mesmo que o schema por baixo continue relacional.

## Decisão

Toda funcionalidade que consome Ativos Clínicos (Protocolos, Dietas, Desafios, e qualquer camada futura que referencie a Biblioteca Clínica) **seleciona** ativos já existentes — nunca **cria** um ativo novo em seu próprio fluxo de UI. Concretamente:

- Protocolos não criam receitas, shots, chás, suplementos, refeições ou materiais — selecionam um ativo já existente na Biblioteca Clínica para compor `protocol_items`/as tabelas de junção `protocol_*`.
- Dietas não criam refeições — selecionam `meals`/`recipes`/`foods` já cadastrados para compor `meal_plan_items`.
- Desafios não criam metas — selecionam `goals` já existentes para compor `challenge_goals`.

Se, ao construir uma dessas telas, faltar o ativo desejado na Biblioteca, o fluxo correto é ir até a Biblioteca Clínica e cadastrá-lo lá (manualmente ou via IA) — nunca abrir um atalho de criação dentro da tela de Protocolo/Dieta/Desafio. Um link de atalho para a Biblioteca Clínica nesse ponto é aceitável; um formulário de criação embutido não é.

## Consequências

**Positivas:**
- A Biblioteca Clínica permanece o único lugar onde um Ativo Clínico nasce — impede fragmentação silenciosa do repositório central conforme novas sub-fases forem entregues.
- Reforça, na camada de UX, a mesma garantia que o ADR-0003 já dá na camada de dados.

**Custos:**
- Exige que a Biblioteca Clínica esteja povoada (ou tenha um caminho rápido de povoamento, como geração por IA) antes que Protocolos/Dietas/Desafios sejam úteis na prática — um formulário de criação embutido seria, isoladamente, mais conveniente no curto prazo. Aceito conscientemente: a conveniência de curto prazo é o exato risco que este ADR existe para evitar.

## Referências

- ADR-0001 (camadas da arquitetura)
- ADR-0002 (contrato de Ativos Clínicos)
- ADR-0003 (Registro Mestre e Instância — proteção equivalente na camada de dados)
- PR #43 (Sub-fase 2 — Biblioteca Clínica)
