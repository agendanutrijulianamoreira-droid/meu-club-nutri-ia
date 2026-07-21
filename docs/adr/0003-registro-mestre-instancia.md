# ADR-0003: Registro Mestre e Instância do Paciente

**Status:** Aceita
**Data:** 2026-07-21
**Contexto da decisão:** Planejamento da Sub-fase 2 (Biblioteca Clínica), decorrente dos ADR-0001 e ADR-0002

## Contexto

A Biblioteca Clínica (ADR-0001, ADR-0002) existe para que uma receita, um shot, uma meta etc. tenham **uma única fonte de verdade**, reaproveitada por múltiplos protocolos, dietas e pacientes. Sem uma regra explícita sobre como o "consumo" desse conteúdo deve ser modelado, o risco natural é que, ao integrar Protocolos/Dietas a esses ativos (Sub-fase 3 e 4), alguém copie o conteúdo do ativo para dentro da tabela consumidora "pra ser mais rápido" — reintroduzindo duplicação — ou, no sentido oposto, escreva a customização da paciente de volta na tabela mestre, corrompendo o conteúdo compartilhado para todos que o usam.

## Decisão

Toda entidade da camada de Ativo Clínico é um **Registro Mestre**: compartilhada, sem contexto de paciente, sem contexto de protocolo específico. Qualquer lugar que "usa" um ativo mestre (`protocol_items` na Sub-fase 3, `meal_plan_items`/`meal_components`/`shot_components`/`tea_components`/`recipe_components` já nesta Sub-fase 2) segue duas regras:

1. **Referenciar, nunca copiar.** A tabela consumidora guarda uma FK nullable para o mestre (`recipe_id`, `food_id`, `supplement_id`, `shot_id` etc.) — nunca duplica `title`/`instructions`/`description` do mestre em suas próprias colunas.
2. **Customização vive na instância, nunca no mestre.** Uma troca de ingrediente, uma quantidade diferente, uma observação da nutricionista para aquela paciente especificamente — tudo isso é coluna própria da linha de instância (ex.: `meal_plan_items.substitution_note`, `meal_components.serving_label` quando diverge do padrão do ativo). Editar o mestre nunca escreve nem apaga essas colunas de instância.

Este padrão já existe corretamente hoje em `meal_plan_items` (FK `food_id` + `substitution_note`/`preparation_notes` próprios) — ele vira a referência de como toda futura tabela de instância deve ser desenhada.

**"Duplicar" não é "instanciar".** Duplicar um ativo mestre (recurso de UI da Biblioteca Clínica, ADR-0002) cria um **novo registro mestre independente** — nova linha, novo `id`, ciclo de vida próprio, sem qualquer referência ao original. É o oposto de uma instância: instância referencia e nunca copia; duplicar copia e nunca referencia.

## Questão explicitamente deixada em aberto (não decidida aqui)

Como a referência ao mestre é sempre "ao vivo" (FK simples, sem snapshot), editar um ativo mestre muda o que uma prescrição **antiga** exibe — ex.: mudar o `title`/`instructions` de uma receita altera como ela aparece em uma dieta já entregue há meses. Resolver isso exigiria versionamento do mestre (congelar uma versão no momento em que a instância foi criada), o que é uma feature maior e não necessária agora. Fica registrado aqui como uma limitação conhecida e aceita nesta fase — a decisão de quando/se implementar versionamento cabe à Sub-fase 3 ou 4, quando `protocol_items`/`meal_plan_items` passarem a referenciar os ativos desta biblioteca de fato.

## Consequências

**Positivas:**
- Nenhuma tabela de instância futura duplicará conteúdo — o padrão já está definido antes de qualquer uma delas ser construída.
- Edição de um ativo mestre é segura e não corrompe o conteúdo de outras pacientes que o usam.

**Custos:**
- Sem versionamento, editar um mestre pode alterar retroativamente a apresentação de prescrições antigas — aceito conscientemente por ora (ver seção anterior).

## Requisito futuro: aviso de dependências antes de arquivar (Sub-fase 3/4)

**Não implementado nesta Sub-fase 2** — registrado aqui porque é consequência direta e inevitável do princípio "Referenciar, nunca copiar" acima: a partir do momento em que `protocol_items`, `meal_plan_items` (e demais tabelas de instância futuras) passarem a referenciar de fato um ativo mestre por FK (Sub-fase 3 em diante), arquivar (`is_active = false`) ou excluir um Registro Mestre passa a ter efeito sobre todo consumidor vivo daquele mestre — uma receita usada em 3 protocolos ativos, uma meta usada em 2 desafios em andamento, etc.

Requisito para quando essas tabelas de instância existirem: antes de permitir arquivar/excluir um ativo mestre pela UI da Biblioteca Clínica, verificar se existe alguma referência ativa (`protocol_items`, `meal_plan_items`, `challenge_goals` etc. com FK para aquele mestre) e, se houver, avisar a nutricionista explicitamente (quantas referências, em quais protocolos/dietas/desafios) antes de confirmar a ação — em vez de arquivar silenciosamente e deixar consumidores vivos apontando para um ativo inativo sem aviso. Não é bloqueio nem prevenção automática, apenas transparência antes da confirmação, no mesmo espírito do `confirm()` já aceito para ações destrutivas (Seção 9 do CLAUDE.md).

Como no momento desta Sub-fase 2 não existe nenhuma tabela de instância referenciando os ativos por FK ainda (o vínculo real só nasce na Sub-fase 3), não há hoje nenhum caso real desse cenário — por isso o requisito fica documentado, não implementado.

## Referências

- ADR-0001 (camadas da arquitetura e fonte única de verdade)
- ADR-0002 (contrato comum de Ativos Clínicos)
- `meal_plan_items` (`supabase/migrations/20260321_foods_meal_plans.sql`) como precedente do padrão referência+override
