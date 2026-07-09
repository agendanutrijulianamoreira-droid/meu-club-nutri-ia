# Roadmap de Evolução — VitaClub

> Documento de estratégia de implementação. Cada Fase é uma unidade de trabalho independente,
> pensada para ser aberta em um chat novo, implementada, revisada, commitada, mesclada na `main`,
> publicada no Vercel e testada antes de passar para a próxima.

---

## Como usar este documento

1. **Uma fase por vez.** Não pule fases nem misture duas no mesmo PR — cada uma tem escopo
   fechado de propósito.
2. **Fluxo por fase:**
   - Criar branch a partir da `main` (`git checkout -b feat/nome-da-fase`)
   - Implementar seguindo a especificação da fase
   - Rodar `npx tsc --noEmit` e corrigir erros (ver filtro de erros aceitáveis na Seção 14 do `CLAUDE.md`)
   - Testar manualmente o fluxo (ver "Como testar" de cada fase)
   - Commit em português (`feat: ...`) e push
   - Abrir PR, revisar o diff, mesclar na `main`
   - Deploy automático no Vercel (ou manual se necessário) — confirmar que o build passou
   - Testar em produção o fluxo principal da fase
   - Marcar a fase como concluída neste arquivo (mudar `[ ]` para `[x]` no índice) e seguir para a próxima
3. **Cada fase abaixo tem uma seção "Prompt para abrir em outro chat"** — copie o bloco e cole em
   uma conversa nova com o Claude Code para implementar aquela fase isoladamente, com todo o
   contexto necessário incluso (não depende deste chat).
4. Este documento assume o estado do código confirmado em 2026-07-07. Se alguma fase já tiver
   sido implementada por fora deste roadmap, valide o estado real antes de começar (grep pelas
   tabelas/arquivos citados) em vez de confiar cegamente na seção "Estado atual".

---

## Índice de fases (ordem recomendada)

| # | Fase | Prioridade | Esforço | Tipo |
|---|---|---|---|---|
| [x] 1 | Resumo IA + Chat IA por paciente (lado admin) — Resumo IA já existia, só faltava o Chat | 🔴 Alta | M | Feature nova |
| [x] 2 | Agente de Engajamento — comentários automáticos em posts (conclusões de desafio/protocolo ficou de fora, ver nota na fase) | 🔴 Alta | M | Feature nova |
| [x] 3 | Recompensas por posição no ranking dos desafios | 🔴 Alta | S | Completar feature existente |
| [x] 4 | Pontuação diferenciada por tipo de comprovação — **só Protocolo**; Desafio virou Fase 13 | 🟡 Média | M | Melhoria de gamificação |
| [ ] 5 | Prontuário clínico (registros por paciente) | 🔴 Alta | L | Feature nova |
| [ ] 6 | Formulários com gatilhos de ciclo de vida | 🟡 Média | M | Extensão de feature existente |
| [ ] 7 | Comunidade aberta/fechada com aprovação de entrada | 🟡 Média | S | Feature nova |
| [ ] 8 | Calendário de eventos comunitários | 🟡 Média | M | Feature nova |
| [ ] 9 | Colaboradores por tenant (moderador/admin) | 🟢 Baixa | M | Feature nova |
| [ ] 10 | Biblioteca → motor de cursos (módulos, aulas, liberação sequencial/agendada) | 🟢 Baixa | L | Reforma de feature existente |
| [ ] 11 | Programas — pacotes vendáveis multi-item | 🟢 Baixa | L | Mudança de modelo de monetização |
| [ ] 12 | Débitos técnicos e melhorias pendentes já conhecidas | 🟡 Média | S (cada item) | Manutenção |
| [ ] 13 | Desafio: mecanismo de participação e conclusão de atividade (com prova) | 🟡 Média | L | Feature nova |

Legenda de esforço: S = 1 sessão curta, M = 1–2 sessões, L = múltiplas sessões / vale quebrar em subfases.

---

## FASE 1 — Resumo IA + Chat IA por paciente (lado admin)

### Objetivo
Dar à nutricionista, dentro do perfil de cada paciente, (a) um botão que gera um resumo em
linguagem natural do histórico daquela paciente e (b) um chat com IA que já carrega todo o
contexto daquela paciente, sem precisar explicar nada manualmente.

### Por que
Hoje a IA com contexto rico só existe no chat **da paciente** (`/api/ai/chat`). O admin não tem
uma forma de "perguntar à IA" sobre um paciente específico usando os dados que o sistema já tem
(streak, protocolo ativo, risco, histórico de check-ins). Isso é uma extensão barata de infra que
já existe (`lib/services/anthropic.ts`, `lib/services/riskScore.ts`) com alto valor percebido.

### Estado atual
- `PatientsView.tsx` já lista pacientes e (confirmar ao abrir) provavelmente tem um painel de
  detalhe por paciente — é ali que a UI nova entra.
- `lib/services/anthropic.ts` expõe `callClaude`, `callClaudeJSON`, `streamClaude` — reusar, não
  recriar.
- `lib/services/riskScore.ts` já centraliza o cálculo de risco — reusar como uma das fontes de
  contexto do resumo.
- Não existe endpoint `POST /api/admin/patients/[id]/ai-summary` nem `POST /api/admin/patients/[id]/ai-chat`.

### O que fazer

**Backend**
- `POST /api/admin/patients/[id]/ai-summary`: monta contexto (nome, objetivo, peso inicial/atual,
  streak, XP, protocolo ativo + dia atual, risk score das 4 dimensões, últimos check-ins
  semanais, adesão 7 dias) e chama `callClaude` com um prompt fixo pedindo um resumo de até
  4 parágrafos com pontos de atenção. Seguir o padrão de autenticação obrigatório da Seção 5 do
  `CLAUDE.md` (verificar `user` e `tenant`, e que o paciente pertence ao tenant).
  Persistir o resultado em uma tabela nova `patient_ai_summaries` (`id`, `tenant_id`, `patient_id`,
  `summary_text`, `generated_by`, `created_at`) — não precisa cache complexo, só histórico de
  quando foi gerado.
- `POST /api/admin/patients/[id]/ai-chat`: recebe `{ message, history }`, monta o mesmo contexto
  rico do paciente como `system` prompt (reusar a lógica de contexto do endpoint de resumo, extrair
  para uma função compartilhada em `lib/services/patientAiContext.ts`), chama `streamClaude` ou
  `callClaude` e retorna a resposta. Não precisa persistir o histórico da conversa em banco na v1
  (pode viver só no estado do componente).

**Migration**
- Nova migration `supabase/migrations/YYYYMMDD000001_patient_ai_summaries.sql` criando
  `patient_ai_summaries` com RLS por tenant (seguir padrão da Seção 11 do `CLAUDE.md`).

**Frontend**
- Dentro do painel de detalhe do paciente em `PatientsView.tsx` (ou componente extraído se o
  arquivo já estiver grande), adicionar:
  - Botão "Resumo IA" com estado de loading (`Loader2` + disabled), que chama o endpoint e
    renderiza o texto num card com `bg-white/5 border border-white/10 rounded-3xl p-5`.
  - Aba ou painel lateral "Chat IA" com histórico de mensagens (padrão visual do chat já usado em
    `/patient/chat`, adaptado ao design system do admin).
- Toast inline em caso de erro, nunca `alert()`.

### Critérios de aceite
- Nutricionista abre um paciente, clica em "Resumo IA" e recebe um texto coerente em <10s.
- Nutricionista consegue fazer uma pergunta livre no chat ("ela teve alguma recaída essa semana?")
  e a resposta reflete dados reais daquele paciente.
- Erro de API não quebra a tela — aparece toast.

### Como testar
1. `npm run dev`, logar como admin, abrir um paciente com dados reais (streak, check-ins).
2. Gerar resumo, conferir que os fatos citados batem com os dados do paciente no banco.
3. Perguntar algo no chat que só é respondível com contexto (ex: "qual o objetivo dela?") e
   confirmar que a IA responde certo sem você ter digitado isso.
4. Testar com um paciente sem histórico nenhum (edge case) — não pode quebrar.

### Prompt para abrir em outro chat
```
Implemente a FASE 1 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Resumo IA + Chat IA por paciente,
lado admin) no repositório meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro. Siga exatamente
a especificação da Fase 1 desse roadmap (endpoints, migration, UI). Ao final rode
npx tsc --noEmit, corrija erros, e me avise que está pronto para eu revisar antes de commitar.
```

---

## FASE 2 — Agente de Engajamento (comentários automáticos)

> **Status: implementado em 2026-07 com escopo ajustado à realidade encontrada no código.**
> Diferenças em relação à especificação original abaixo (mantida como registro histórico):
> - **Não foi criada `community_comments`** — já existia uma tabela de comentários em produção
>   sob outro nome (`comentarios_comunidade`, em português, por isso o grep sugerido não achou),
>   já com endpoints GET/POST funcionais (`/api/patient/feed/[id]/comentar`,
>   `/api/admin/comunidade/comentarios`). Só foi adicionada a coluna `is_ai_generated`.
> - **Avatar da persona não foi implementado** — só nome + instruções de tom/restrições. Pode
>   ser adicionado depois se fizer falta.
> - **Comentário em "hits" de desafio/protocolo ficou fora do escopo** — não existe hoje nenhum
>   evento de conclusão de atividade disparando o orchestrator (`triggerOrchestrator` só é chamado
>   em `checkin_submitted` e `stripe_webhook`). Construir esse gancho é trabalho novo, não coberto
>   por esta fase — ver item novo sugerido abaixo.
> - **Dois bugs pré-existentes foram descobertos e corrigidos junto**, por estarem no mesmo evento
>   (`post_created`) que este agente passou a disparar de verdade pela primeira vez:
>   `runCommunityAgent` e `runCommunityModerationAgent` referenciavam uma tabela `posts`/coluna
>   `content` que nunca existiram em produção (a real é `community_posts`/`body`) — o agente
>   Community tinha 100% de falha em 42/42 execuções, e o Community Moderation nunca tinha
>   disparado nenhuma vez porque `triggerOrchestrator('post_created', ...)` nunca era chamado em
>   lugar nenhum do código, apesar de `CLAUDE.md` documentar esse trigger como ativo. Ver nota
>   datada na Seção 16 do `CLAUDE.md` para o detalhe completo.
> - Detalhes técnicos exatos: ver `supabase/functions/agent-orchestrator/index.ts`
>   (`runEngagementAgent`), `supabase/migrations/20260707000001_engagement_agent.sql`,
>   `app/admin/views/AISettingsView.tsx` (aba "Agente de Engajamento"),
>   `app/patient/feed/page.tsx` (`CommentsSection`).
>
> **Item novo sugerido para o backlog** (não estava no roadmap original): criar um evento
> `activity_completed` disparado quando uma paciente conclui uma atividade de desafio/protocolo
> (hoje esse "hit" não gera nenhum evento pro orchestrator), e então estender `runEngagementAgent`
> para também comentar nesses casos — só depois disso a parte "conclusões de desafio/protocolo"
> desta fase original fica de fato viável.

### Objetivo
Um agente de IA configurável pela nutricionista (nome, avatar, tom, instruções positivas e
restritivas) que comenta automaticamente em posts do feed e em conclusões de desafio/protocolo,
como um gestor de comunidade virtual.

### Por que
Os agentes atuais do orchestrator (Community, Community Moderation) **geram** posts próprios ou
**moderam** — nenhum reage individualmente ao que cada paciente publica. Comentário automático
personalizado por conclusão de atividade é uma alavanca de retenção validada (a pessoa se sente
vista) e reaproveita 100% da arquitetura de prompt em 3 camadas já documentada na Seção 6 do
`CLAUDE.md`.

### Estado atual
- `agent-orchestrator` (Supabase Edge Function) já tem 9 agentes documentados na Seção 12 do
  `CLAUDE.md`, disparados por eventos (`cron_daily`, `checkin_submitted`, `meal_logged`,
  `post_created`, `stripe_webhook`, `manual`).
- `community_posts` (migration `20260313000001_community_feed.sql`) não tem tabela de comentários
  — só `community_reactions` (emoji, 1 por usuário por post). **Confirmar se existe uma tabela de
  comentários de texto antes de começar** (`grep -rn "community_comments\|post_comments" supabase/`);
  se não existir, esta fase precisa criá-la.
- `tenants.settings` (JSONB) já guarda `{ ai: { tone, emojiLevel } }` — é o lugar natural para
  guardar a config da persona do agente (`settings.ai.engagement_persona`).

### O que fazer

**Migration**
- Se não existir, criar `community_comments` (`id`, `post_id`, `tenant_id`, `user_id` nullable
  para permitir autor = agente, `author_type` `'patient' | 'agent'`, `body`, `created_at`), com
  RLS igual ao padrão de `community_posts`.
- Adicionar coluna/objeto em `tenants.settings.ai.engagement_persona`:
  `{ enabled, name, avatar_url, tone_instructions, restricted_instructions,
  comment_on: { posts, challenge_hits, protocol_hits } }`.

**Backend**
- Novo agente `engagement` no `agent-orchestrator`: disparado em `post_created` (comentário no
  post) e em `checkin_submitted` / conclusão de item de desafio/protocolo (comentário de
  parabenização). Monta prompt com: persona configurada (camada 2) + contexto do
  paciente/atividade concluída (camada 3), gera um comentário curto (1–2 frases), insere em
  `community_comments` com `author_type = 'agent'`.
  Seguir o padrão de chamada IA em Edge Functions já documentado na Seção 12 do `CLAUDE.md`.
- Endpoint admin `PATCH /api/admin/settings` (ou endpoint dedicado) para salvar
  `settings.ai.engagement_persona`.

**Frontend**
- Nova seção dentro de `AISettingsView.tsx` ("Laboratório IA"): configurar nome, avatar (usar
  `useStorage` para upload), instruções positivas/restritivas (dois textareas), toggles de onde
  comentar (posts / hits de desafio / hits de protocolo).
- No feed (`/patient/feed` e na visão de comunidade do admin), renderizar comentários existentes
  abaixo de cada post, distinguindo visualmente comentário do agente (badge pequeno "IA" ou nome
  configurado) de comentário humano.

### Critérios de aceite
- Nutricionista configura a persona, ativa "comentar em posts", uma paciente publica algo no feed
  e em poucos segundos aparece um comentário coerente com a persona configurada.
- Desativar o agente para um dos três surfaces (posts/desafio/protocolo) realmente impede o
  comentário automático nesse surface.
- Instruções restritivas são respeitadas (testar pedindo para nunca mencionar "diagnóstico" e
  confirmar que não aparece).

### Como testar
1. Configurar a persona no Laboratório IA com um tom bem específico e reconhecível.
2. Publicar um post como paciente de teste, aguardar e conferir o comentário automático.
3. Completar uma atividade de desafio como paciente de teste e conferir comentário de parabéns.
4. Desativar o agente e confirmar que novos posts não recebem comentário.

### Prompt para abrir em outro chat
```
Implemente a FASE 2 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Agente de Engajamento com
comentários automáticos) no repositório meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro,
com atenção especial à Seção 12 (Edge Functions & Orquestra de Agentes). Antes de criar
community_comments, rode um grep para confirmar que essa tabela realmente não existe ainda.
Siga a especificação da Fase 2 do roadmap. Ao final rode npx tsc --noEmit, corrija erros, e
avise que está pronto para revisão antes de commitar.
```

---

## FASE 3 — Recompensas por posição no ranking dos desafios ✅ CONCLUÍDA (2026-07-07)

> **Correção em relação ao plano original**: a premissa desta fase estava errada.
> `challenges.rewards_json` **já é usado em produção** pelo builder de missões diárias
> (`app/admin/desafios/builder/page.tsx`), que grava `{ days, feedPosts }` — não é um
> campo livre esperando ser preenchido com recompensas por posição. Reaproveitá-lo
> teria colidido com esse uso existente. A implementação real criou uma coluna nova
> `challenges.ranking_rewards JSONB` (migration `20260707000002_challenge_ranking_rewards.sql`,
> aplicada em produção), no formato `[{ position, label, image_url }]`, exatamente como
> o roadmap sugeria — só que num campo próprio em vez do `rewards_json` existente.
> UI implementada em `ChallengesView.tsx` (editor de recompensas por posição, upload de
> imagem via `useStorage`) e no ranking da paciente (`app/patient/feed/page.tsx`, aba
> Ranking), destacando a posição da própria paciente. `GET /api/patient/ranking` passou
> a retornar `ranking_rewards` junto com os dados do desafio.

### Objetivo
Permitir que a nutricionista defina, na criação/edição de um desafio, o que cada posição do
ranking final ganha (com imagem opcional), e exibir isso para as pacientes antes/durante a
participação.

### Por que
Esta é a fase mais barata do roadmap: **o campo já existe no banco e já é lido/gravado pelo
código**, só falta a UI. `challenges.rewards_json` (migration
`20260526000003_create_challenges_and_fix_rls.sql`) já é persistido por `ChallengesView.tsx`
(linhas 173 e 234), mas não existe nenhum editor visual para preenchê-lo — hoje ele só carrega o
valor anterior adiante ou fica `null`.

### Estado atual
- `challenges.rewards_json JSONB DEFAULT '[]'::jsonb` — formato sugerido:
  `[{ position: 1, label: "Vale-consulta grátis", image_url: "..." }, { position: 2, ... }]`.
- `ChallengesView.tsx` já tem `form.rewards_json` no estado, só falta o componente de edição.
- Confirmar se a tela de ranking da paciente (dentro de `/patient/feed`, aba Ranking, conforme
  Seção 16 do `CLAUDE.md`) já exibe algo de `rewards_json` — provavelmente não.

### O que fazer

**Frontend (admin)**
- Em `ChallengesView.tsx`, no formulário de criação/edição do desafio, adicionar uma seção
  "Recompensas por posição": lista editável (adicionar/remover linha), cada linha com posição
  (número), label (texto) e upload de imagem opcional via `useStorage` (bucket existente, seguir
  convenção de buckets da Seção 2 do `CLAUDE.md` — se não houver bucket adequado, usar `library`).
  Serializar para `rewards_json` no formato acima ao salvar.

**Frontend (paciente)**
- Na tela onde a paciente vê os detalhes do desafio antes de entrar (e/ou na aba Ranking do feed),
  renderizar a lista de recompensas por posição, com destaque para a posição em que a própria
  paciente está no momento (se já estiver participando).

### Critérios de aceite
- Nutricionista define recompensas para as posições 1, 2 e 3 de um desafio, salva, edita depois e
  os valores persistem corretamente.
- Paciente vê as recompensas antes de entrar no desafio.

### Como testar
1. Criar um desafio novo, configurar recompensas para 3 posições com imagem.
2. Reabrir o desafio para editar — confirmar que os valores salvos aparecem certos.
3. Acessar como paciente e confirmar a exibição das recompensas.

### Prompt para abrir em outro chat
```
Implemente a FASE 3 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Recompensas por posição no ranking
dos desafios) no repositório meu-club-nutri-ia. Leia o CLAUDE.md primeiro. O campo
challenges.rewards_json já existe no banco e já é lido/gravado por app/admin/views/ChallengesView.tsx
— esta fase é só UI (editor no admin + exibição na tela da paciente), não precisa de migration.
Siga a especificação da Fase 3 do roadmap. Ao final rode npx tsc --noEmit, corrija erros, e avise
que está pronto para revisão antes de commitar.
```

---

## FASE 4 — Pontuação diferenciada por tipo de comprovação

### Objetivo
Ao concluir uma atividade de desafio/protocolo, dar pontuação diferente conforme o tipo de prova:
foto tirada na hora (câmera) > foto escolhida da galeria > sem foto (registro simples).

### Por que
Hoje a gamificação do VitaClub é XP fixo por tipo de ação (Seção 10 do `CLAUDE.md`, ex: "check-in
diário completo: +30 XP"), sem diferenciar o rigor da comprovação. Isso é um incentivo perverso —
não há custo em "só marcar como feito" vs. realmente provar com foto na hora. É uma melhoria de
retenção/anti-fraude com escopo pequeno se a captura de foto já registra metadado de origem.

### Estado atual — **confirmar antes de especificar a solução**
Esta fase depende de decisões de arquitetura de dados que precisam ser confirmadas primeiro,
porque não foi possível inspecionar neste chat:
1. Onde vive a conclusão de uma atividade de desafio/protocolo hoje? (`daily_logs`?
   `protocol_assignments`? uma tabela de "activity completions" separada?)
2. O upload de foto (`/patient/foto-refeicao`, `analyze-plate`) já registra se veio da câmera ao
   vivo ou da galeria? Verificar se o componente de captura no app usa `<input capture="environment">`
   (força câmera) vs. seletor de arquivo livre, e se isso é registrado em algum campo.
3. `awardPoints` em `lib/services/gamification.ts` (Seção 16 do `CLAUDE.md`, já é a escrita
   centralizada de XP) — confirmar a assinatura atual da função antes de estender.

> **Achado da Fase 3 (2026-07-07)**: o módulo de **Hábitos** (`habit_logs`, migration
> `20260624000001_habits.sql`, UI `app/patient/habits/page.tsx`) **já implementa exatamente essa
> diferenciação** — campo `hit_type` (`'camera' | 'gallery' | 'simple'`) com uma constante
> `HABIT_HIT_XP` que premia XP diferente por tipo, escrito via `awardPoints` em
> `app/api/patient/habits/route.ts`. `hit_type` inclusive já é usado como critério de desempate
> no ranking de desafios (`app/api/patient/ranking/route.ts`). O que **não existe** é o mesmo
> mecanismo para conclusões de **desafio/protocolo** especificamente — só para Hábitos. Ao
> implementar esta fase, avaliar se dá para reaproveitar o mesmo padrão (`hit_type` +
> `HABIT_HIT_XP`-like) em vez de desenhar algo do zero, e se "atividade de desafio/protocolo"
> hoje sequer tem uma tabela de conclusão própria ou se usa `daily_logs`/`habit_logs` por baixo.

### O que fazer (após confirmar o estado atual acima)
- Adicionar um campo `proof_type` (`'camera' | 'gallery' | 'none'`) no registro de conclusão de
  atividade.
- No fluxo de captura de foto do app da paciente, diferenciar tecnicamente câmera-ao-vivo de
  galeria (ex: usar `capture` attribute + fallback, ou dois botões distintos "Tirar foto agora" /
  "Escolher da galeria").
- Estender `awardPoints` para aceitar um multiplicador ou pontos explícitos por `proof_type`,
  configurável por atividade (campos de pontuação por tipo na criação de atividade/desafio/protocolo,
  como visto nas telas de `ChallengesView.tsx` / `ProtocolsView.tsx`).
- Atualizar a UI de criação de atividade dentro de desafios/protocolos para pedir 3 valores de
  pontos (câmera / galeria / sem foto) em vez de 1 valor fixo.

### Critérios de aceite
- Duas pacientes completam a mesma atividade, uma com foto na hora e outra sem foto — a que tirou
  foto na hora recebe mais XP/NutriCoins, de forma auditável nos logs.
- Nutricionista consegue configurar os 3 valores de pontuação por atividade.

### Como testar
1. Configurar uma atividade com pontuação diferente para os 3 modos.
2. Completar como paciente de teste usando cada um dos 3 modos, conferir o XP recebido em cada
   caso via `patient_risk_scores`/perfil (total_xp) ou log de gamificação.

### Prompt para abrir em outro chat
```
Implemente a FASE 4 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Pontuação diferenciada por tipo de
comprovação) no repositório meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro. ATENÇÃO: antes
de escrever qualquer código, investigue e responda as 3 perguntas da seção "Estado atual" da
Fase 4 do roadmap (onde vive a conclusão de atividade, como o app captura foto hoje, e a
assinatura atual de awardPoints em lib/services/gamification.ts). Só depois disso, proponha e
implemente o plano concreto de acordo com o que encontrar — a especificação da fase é
intencionalmente aberta nesse ponto porque depende do que já existe. Ao final rode
npx tsc --noEmit, corrija erros, e avise que está pronto para revisão antes de commitar.
```

### Status (2026-07-09)
Implementado **só o lado Protocolo**, que era o único com um mecanismo real de conclusão de
atividade (`protocol_items`/`protocol_progress`, populado hoje pelo builder de
`app/admin/seasonal-protocols/`). Achados que mudaram o escopo original:
- `protocol_items` ganhou `points_camera`/`points_gallery` (migration
  `20260709000001_protocol_proof_points.sql`, aditiva, com backfill = valor de `points` para não
  mudar XP de itens já criados); `protocol_progress` ganhou `proof_type` (o campo `photo_url` já
  existia na tabela, só nunca era escrito por nenhum código).
- `POST /api/patient/protocol-progress` agora resolve os pontos pelo `protocol_item` no servidor
  em vez de aceitar `points` do body — o código anterior confiava cegamente no valor mandado pelo
  client, o que permitia inflar XP artificialmente.
- UI da paciente (`/patient/home`): item do protocolo ganhou botões de "enviar da galeria" e
  "tirar foto agora" ao lado do toque simples, espelhando o padrão já usado em `/patient/habits`.
  Bucket novo `protocol-photos` (mesma policy de `habit-photos`: leitura pública, escrita/remoção
  restrita ao prefixo `auth.uid()` no path).
- UI do admin (`app/admin/seasonal-protocols/new/page.tsx`, que é quem realmente grava em
  `protocol_items` hoje — `ProtocolsView.tsx`/`app/admin/protocols/new/page.tsx` gravam só em
  `protocols.content_json`, um sistema paralelo não lido pelo app da paciente): 3 campos de
  pontuação por item (sem foto / galeria / câmera) em vez do único campo `points`, que antes nem
  tinha input nenhum na tela (sempre ficava fixo em 10 na criação).
- **Desafio ficou de fora**: não existe hoje nenhum mecanismo de participação em desafio no app da
  paciente (sem tela de "entrar no desafio", sem "missões do dia"; `challenge_participants.score`
  nunca é escrito em lugar nenhum do código). As "missões" já desenhadas pelo builder de desafios
  (`app/admin/desafios/builder/page.tsx`, salvas em `rewards_json.days[].missions[]`) nunca chegam
  a aparecer para a paciente. Construir isso é escopo de múltiplas sessões, não um ajuste de
  pontuação — virou a **Fase 13** (ver abaixo), a ser planejada e implementada separadamente.

---

## FASE 5 — Prontuário clínico (registros por paciente)

### Objetivo
Uma área, visível só para a nutricionista (nunca para a paciente), com histórico cronológico de
registros clínicos por paciente: encaminhamento, evolução clínica, exame, nota, observação — cada
um com tag (cor + ícone) e anexo opcional.

### Por que
É a peça que falta para o produto ser defensável como ferramenta clínica e não só de engajamento.
Hoje `daily_logs` e `weekly_checkin_responses` são dados operacionais/gamificados — não existe
espaço de anotação livre e privada do profissional.

### Estado atual
- Não existe tabela equivalente. Confirmar com um `grep -rln "patient_records\|prontuario" supabase/`
  antes de começar, pra garantir que ninguém criou isso em paralelo.
- Buckets de storage existentes: `logos`, `library`, `social-proof` (Seção 2 do `CLAUDE.md`) —
  nenhum serve para anexos de prontuário; será preciso um bucket novo, ex: `patient-records`, com
  policy de acesso restrita ao dono do tenant (nunca público).

### O que fazer

**Migration**
- `patient_records` (`id`, `tenant_id`, `patient_id`, `type` — enum
  `'encaminhamento' | 'evolucao_clinica' | 'exame' | 'nota' | 'observacao'`, `title`, `body`,
  `attachment_url` nullable, `created_by` (user_id do admin/profissional que criou), `created_at`).
- `patient_record_tags` (`id`, `tenant_id`, `name`, `color`, `icon`) — tags customizáveis por
  tenant, reutilizáveis entre registros.
- `patient_record_tag_links` (tabela de junção `record_id` ↔ `tag_id`) ou um array
  `tag_ids UUID[]` direto em `patient_records`, dependendo da preferência de simplicidade (array é
  suficiente para o volume esperado; evite over-engineering).
- RLS: **apenas** `role IN ('admin', 'nutritionist')` do próprio tenant pode ler/escrever. A
  paciente (`role = 'patient'`) não deve ter nenhuma policy de SELECT nesta tabela — teste isso
  explicitamente.
- Bucket novo `patient-records` no Supabase Storage, privado.

**Backend**
- `GET/POST /api/admin/patients/[id]/records` — listar e criar registros.
- `PATCH/DELETE /api/admin/patients/[id]/records/[recordId]` — editar/remover.
- `GET/POST /api/admin/record-tags` — CRUD de tags do tenant.
- Seguir à risca o padrão de autenticação + verificação de tenant da Seção 5/9 do `CLAUDE.md`, e
  confirmar explicitamente que `patient_id` pertence ao `tenant_id` do admin autenticado antes de
  qualquer escrita.

**Frontend**
- Nova sub-área dentro do detalhe do paciente em `PatientsView.tsx`: "Prontuário", com timeline de
  registros (mais recente primeiro), botão "Novo registro" (modal com tipo, título, corpo, tags,
  upload de anexo via `useStorage`), badges de tag coloridas (padrão de badge da Seção 4 do
  `CLAUDE.md`).
- Deixar claro na UI (texto pequeno) que esta área não é visível para a paciente.

### Critérios de aceite
- Nutricionista cria um registro de "evolução clínica" com anexo, ele aparece na timeline do
  paciente correto e só dele.
- Login como paciente não consegue acessar esses dados por nenhuma rota (testar tentando chamar o
  endpoint admin autenticado como paciente — deve retornar 403).
- Tags são reutilizáveis entre registros diferentes do mesmo tenant.

### Como testar
1. Criar 2 pacientes de teste, criar registros em cada um, confirmar isolamento (paciente A não
   vê registros de paciente B).
2. Tentar acessar `/api/admin/patients/[id]/records` autenticado como paciente — esperar 401/403.
3. Testar upload de anexo (PDF e imagem) e confirmar que o link funciona e é privado (não acessível
   sem autenticação).

### Prompt para abrir em outro chat
```
Implemente a FASE 5 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Prontuário clínico) no repositório
meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro. Antes de criar qualquer tabela, rode
grep -rln "patient_records\|prontuario" supabase/ para confirmar que isso não existe ainda. Preste
atenção especial em RLS: pacientes NUNCA podem ler esta tabela, só admin/nutritionist do próprio
tenant. Siga a especificação da Fase 5 do roadmap. Ao final rode npx tsc --noEmit, corrija erros,
e escreva um teste manual explícito confirmando que paciente não acessa os dados antes de avisar
que está pronto para revisão.
```

---

## FASE 6 — Formulários com gatilhos de ciclo de vida

### Objetivo
Estender o sistema de questionários já existente para poder ser disparado automaticamente em
momentos-chave: pós-compra de plano, primeiro acesso (onboarding), ou vinculado a uma atividade de
protocolo/desafio específica (com opção de tornar obrigatório para avançar).

### Por que
O builder de formulário **já existe** (`questionnaires` / `questionnaire_questions`, migration
`20260528000001_questionnaires.sql`, UI em `QuestionnairesView.tsx`) com tipos de pergunta (texto,
textarea, select, multiselect, sim/não, escala) e até um campo `plan_filters` para segmentação.
O que falta é o **disparo automático por evento** — hoje ele parece ser preenchido manualmente/por
link, não empurrado no momento certo. Isso é uma extensão, não uma feature nova do zero.

### Estado atual
- Tabelas confirmadas: `questionnaires` (com `plan_filters TEXT[]`), `questionnaire_questions`,
  `questionnaire_responses`. Também existem `plan_automations` e `automation_triggers` na mesma
  migration — **investigar se esse mecanismo de trigger já cobre parte do que essa fase pede**
  antes de criar algo novo redundante (ler `app/api/admin/checkins/questionnaires` e o código que
  lê `automation_triggers`).
- Não há campo de "disparar no onboarding" nem "disparar pós-compra" nem "vincular a atividade" em
  `questionnaires` hoje (confirmar com grep antes de assumir).

### O que fazer
- Migration incremental (não recriar as tabelas): adicionar em `questionnaires` os campos
  `trigger_type TEXT CHECK (trigger_type IN ('manual', 'onboarding', 'post_purchase', 'activity_linked'))`,
  `linked_activity_id UUID` (nullable, referência à atividade/protocolo/desafio relevante — usar o
  tipo de referência que já existir no schema de protocolos/desafios), `is_required_to_advance BOOLEAN`,
  `allow_multiple_responses BOOLEAN`, `notify_admin_on_completion BOOLEAN`.
- No fluxo de onboarding pós-Stripe (o Onboarding Agent do orchestrator, Seção 12 do `CLAUDE.md`,
  disparado por `stripe_webhook`), checar se existe um `questionnaire` com `trigger_type = 'onboarding'`
  ativo para o tenant e, se sim, inserir um item na inbox da paciente apontando para ele.
- No momento de conclusão de checkout de um programa/plano (`/api/checkout`, webhook Stripe), fazer
  o mesmo para `trigger_type = 'post_purchase'`.
- Na tela de atividade de protocolo/desafio da paciente, se a atividade tiver um `questionnaire`
  vinculado com `is_required_to_advance = true`, bloquear a conclusão até o formulário ser
  respondido.

### Critérios de aceite
- Um formulário marcado como "onboarding" aparece automaticamente para uma paciente nova, sem
  intervenção manual da nutricionista.
- Um formulário vinculado a uma atividade obrigatória realmente impede a conclusão da atividade
  até ser respondido.

### Como testar
1. Configurar um formulário de onboarding, criar uma paciente nova (fluxo real de assinatura de
   teste), confirmar que o formulário aparece no primeiro acesso.
2. Vincular um formulário obrigatório a uma atividade de protocolo, tentar concluir a atividade
   sem responder — deve bloquear; responder e tentar de novo — deve liberar.

### Prompt para abrir em outro chat
```
Implemente a FASE 6 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Formulários com gatilhos de ciclo de
vida) no repositório meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro. IMPORTANTE: antes de
criar qualquer coisa nova, leia supabase/migrations/20260528000001_questionnaires.sql por completo
e investigue o que plan_automations/automation_triggers dessa mesma migration já fazem hoje (grep
por onde são lidos no código) — pode ser que parte do que esta fase pede já exista sob outro nome.
Só depois disso, siga a especificação da Fase 6 do roadmap, ajustando se encontrar que algo já
está parcialmente resolvido. Ao final rode npx tsc --noEmit, corrija erros, e avise que está
pronto para revisão antes de commitar.
```

---

## FASE 7 — Comunidade aberta/fechada com aprovação de entrada

### Objetivo
Permitir que a nutricionista escolha se sua comunidade é de entrada livre ou se cada solicitação
de entrada precisa de aprovação manual antes da pessoa virar membro.

### Por que
Hoje o modelo de entrada é implicitamente "a nutricionista cadastra a paciente" (via
`/api/admin/create-patient` ou fluxo Stripe). Não há um fluxo de auto-cadastro com fila de
aprovação. Isso é relevante se o produto passar a aceitar entrada mais orgânica/gratuita na
comunidade (não só via checkout pago).

### Estado atual — **confirmar se esta fase é realmente prioritária antes de implementar**
Diferente das outras fases, esta depende de uma decisão de produto: o VitaClub hoje parece
depender do Stripe (checkout) como porta de entrada principal, não de auto-cadastro livre. Um
fluxo de "solicitar entrada / aprovar manualmente" só faz sentido se houver (ou for planejado) um
caminho de cadastro sem pagamento (ex: comunidade gratuita/free tier com upsell depois — o que
seria coerente com o `current_plan = 'community'` já existente em `profiles`). **Confirmar essa
premissa com o dono do produto antes de implementar.**

### O que fazer (se confirmado que faz sentido)
- Adicionar em `tenants.settings`: `{ community: { is_closed: boolean } }`.
- Nova tabela `community_join_requests` (`id`, `tenant_id`, `user_id`, `status` `'pending'|'approved'|'rejected'`,
  `requested_at`, `reviewed_at`).
- Fluxo de cadastro: se `is_closed = true`, criar o profile com um estado "pendente" (não vira
  `patient` ativo até aprovação) em vez do fluxo direto atual.
- UI admin: toggle em `SettingsView.tsx` (padrão de Toggle já documentado na Seção 4 do
  `CLAUDE.md`) + uma lista de solicitações pendentes com aprovar/rejeitar (pode reaproveitar o
  padrão visual de `ApprovalsView.tsx`, que já existe para aprovações de ações de agente — **não é
  a mesma fila**, mas o componente visual de card de aprovação pode ser reaproveitado como
  referência de estilo).

### Critérios de aceite
- Com comunidade fechada ativada, um novo cadastro fica pendente e não aparece como paciente ativo
  até a nutricionista aprovar.
- Com comunidade aberta (padrão), o cadastro continua funcionando exatamente como hoje.

### Como testar
1. Ativar comunidade fechada, simular um cadastro novo, confirmar que fica pendente.
2. Aprovar na UI, confirmar que a pessoa passa a ter acesso normal.
3. Rejeitar um outro caso, confirmar que a pessoa não ganha acesso.

### Prompt para abrir em outro chat
```
Implemente a FASE 7 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Comunidade aberta/fechada com
aprovação de entrada) no repositório meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro. ANTES
de escrever código, releia a seção "Estado atual" da Fase 7 do roadmap — ela levanta uma dúvida de
premissa de produto (se hoje o cadastro é só via Stripe, um fluxo de aprovação manual pode não ser
prioritário). Se não tiver como confirmar comigo nesse chat, implemente mesmo assim seguindo a
especificação, mas deixe registrado no PR essa ressalva. Ao final rode npx tsc --noEmit, corrija
erros, e avise que está pronto para revisão antes de commitar.
```

---

## FASE 8 — Calendário de eventos comunitários

### Objetivo
A nutricionista cria eventos (lives semanais, encontros presenciais) recorrentes ou únicos, com
link (online) ou endereço/mapa (presencial), visíveis na agenda de todas as pacientes do tenant.

### Por que
Não existe hoje um calendário de eventos **visível para as pacientes**. `scheduled_events`
(schema legado, Seção 16 do `CLAUDE.md`) é um mecanismo de agendamento **interno** de
push/conteúdo/desafio (a "Régua de Eventos"), não um calendário social. `AppointmentsView.tsx` é
agendamento **individual** de consulta 1:1 entre profissional e paciente, com relatório
pré-consulta — também não serve para "todo mundo vê o mesmo evento".

### Estado atual
- Confirmar que realmente não existe nada equivalente antes de começar:
  `grep -rln "community_events" supabase/ app/`.
- Reaproveitar o padrão de recorrência já usado em `scheduled_events.recurrence_id` (Seção 16 do
  `CLAUDE.md`) como referência de como o projeto já resolve recorrência, em vez de inventar um
  mecanismo novo.

### O que fazer

**Migration**
- `community_events` (`id`, `tenant_id`, `title`, `description`, `is_online BOOLEAN`,
  `meeting_link TEXT`, `location_address TEXT`, `location_lat/lng` se for usar mapa,
  `starts_at TIMESTAMPTZ`, `ends_at TIMESTAMPTZ`, `recurrence_id UUID` nullable (mesmo padrão de
  `scheduled_events`), `created_by`, `created_at`).
- RLS: admin do tenant cria/edita; pacientes do tenant só leem.

**Backend**
- `GET/POST /api/admin/community-events`, `PATCH/DELETE /api/admin/community-events/[id]`.
- `GET /api/patient/community-events` — lista eventos futuros do tenant da paciente.

**Frontend**
- Nova view admin (`CommunityEventsView.tsx` ou dentro de `CommunicationCenterView.tsx` como nova
  aba, para não fragmentar demais o menu — avaliar qual encaixa melhor ao implementar).
- Nova tela/aba no app da paciente mostrando os próximos eventos (a Seção 8 do `CLAUDE.md` não
  lista uma página de eventos hoje — decidir se entra em "Mais" na navegação reorganizada
  mencionada na Seção 16, ou ganha destaque na Home).
- Se for evento presencial, exibir endereço com link para abrir no mapa (Google Maps via URL, sem
  precisar de SDK de mapa embutido).

### Critérios de aceite
- Nutricionista cria uma live semanal recorrente, ela aparece corretamente em todas as ocorrências
  futuras esperadas na agenda das pacientes.
- Evento presencial mostra endereço e abre no mapa corretamente.

### Como testar
1. Criar evento recorrente semanal, confirmar geração das próximas 4 ocorrências.
2. Criar evento único presencial, confirmar exibição do endereço/link de mapa como paciente.
3. Editar/cancelar um evento e confirmar que reflete para as pacientes.

### Prompt para abrir em outro chat
```
Implemente a FASE 8 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Calendário de eventos comunitários) no
repositório meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro. Antes de criar a tabela
community_events, rode grep -rln "community_events" supabase/ app/ para confirmar que não existe
ainda, e leia supabase/schema_scheduled_events.sql para entender o padrão de recorrência já usado
no projeto (recurrence_id) — reaproveite esse padrão em vez de inventar um novo mecanismo de
recorrência. Siga a especificação da Fase 8 do roadmap. Ao final rode npx tsc --noEmit, corrija
erros, e avise que está pronto para revisão antes de commitar.
```

---

## FASE 9 — Colaboradores por tenant (moderador/admin)

### Objetivo
Permitir que a nutricionista adicione outras pessoas (secretária, outro profissional) para
ajudar a gerenciar a comunidade, com nível de acesso moderador ou administrador.

### Por que
Hoje o modelo é "1 tenant = 1 owner" (`tenants.owner_id`). Times pequenos com assistente/segundo
profissional não têm como colaborar sem compartilhar a conta principal — risco de segurança e
limitação real de operação para clínicas maiores.

### Estado atual
- Existe uma tabela `professional_profiles` (migration `20260215000000_team_marketplace.sql`) com
  um campo `is_moderator BOOLEAN` — **mas ela é do sistema de marketplace de profissionais
  parceiros** (comissão, referral code, dados bancários — Seção "ProfessionalsView"), não um
  sistema de colaboradores administrativos do mesmo tenant. **Não reaproveitar essa tabela
  diretamente** — são conceitos diferentes (parceiro que vende vs. funcionário que administra).
  Confirmar isso lendo `supabase/migrations/20260215000000_team_marketplace.sql` por completo
  antes de decidir a modelagem.
- `profiles.role` hoje é `'patient' | 'admin' | 'nutritionist'` (Seção 5 do `CLAUDE.md`) — não tem
  granularidade de moderador vs. administrador completo dentro do mesmo tenant.

### O que fazer
- Nova tabela `tenant_collaborators` (`id`, `tenant_id`, `user_id`, `access_level`
  `'moderator' | 'admin'`, `invited_by`, `invited_at`, `accepted_at` nullable).
- Fluxo de convite: a pessoa precisa já ter uma conta como `profile` (paciente/membro) no tenant
  antes de virar colaboradora (mesmo padrão descrito no vídeo de referência: "ela tem que já ser
  um membro previamente") — ou, alternativa mais simples, convite direto por e-mail que cria a
  conta se não existir. Definir isso explicitamente antes de implementar, já que muda o fluxo de
  auth.
- Middleware/verificação de permissão: todo endpoint admin que hoje só checa
  `tenant.owner_id === user.id` precisa também aceitar `tenant_collaborators` com `access_level`
  compatível com a ação (ex: moderador não deve poder mexer em billing/configurações sensíveis,
  só em comunidade/conteúdo). **Isso tem blast radius grande** — toca praticamente todas as rotas
  admin da Seção 9 do `CLAUDE.md`. Vale considerar uma função central `resolveTenantAccess(userId)`
  que substitua o padrão repetido de "buscar tenant por owner_id" em todas as rotas, para não
  precisar editar dezenas de arquivos manualmente com risco de esquecer um.

### Critérios de aceite
- Owner adiciona um colaborador como moderador; ele consegue logar e gerenciar comunidade/conteúdo
  mas não acessa billing/configurações sensíveis do tenant.
- Colaborador administrador tem acesso equivalente ao owner, exceto ações que só fazem sentido
  para o dono real (ex: mudar dados de pagamento/split — decidir escopo exato ao implementar).

### Como testar
1. Criar um colaborador moderador, logar como ele, confirmar acesso permitido e bloqueado
   corretamente em pelo menos 3 endpoints sensíveis diferentes.
2. Confirmar que o owner continua com acesso total.

### Prompt para abrir em outro chat
```
Implemente a FASE 9 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Colaboradores por tenant) no
repositório meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro. ATENÇÃO: leia por completo
supabase/migrations/20260215000000_team_marketplace.sql antes de modelar qualquer coisa — existe
uma tabela professional_profiles com campo is_moderator que pertence a um sistema de marketplace
de parceiros (comissão/referral), conceito DIFERENTE do que esta fase pede (colaborador
administrativo do mesmo tenant). Não reaproveite essa tabela. Esta fase tem blast radius grande
(toca a maioria das rotas /api/admin/*) — antes de editar rota por rota, proponha e implemente uma
função central de resolução de acesso ao tenant, e só depois migre as rotas existentes para usá-la.
Siga a especificação da Fase 9 do roadmap. Ao final rode npx tsc --noEmit, corrija erros, e avise
que está pronto para revisão antes de commitar.
```

---

## FASE 10 — Biblioteca → motor de cursos

### Objetivo
Evoluir a Biblioteca do Reino de um acervo de conteúdo solto para suportar também cursos
estruturados: módulos → aulas, editor de blocos (título/texto/tabela/lista/imagem/vídeo/áudio),
liberação livre ou sequencial, lançamento imediato ou agendado por aula, com métricas de
inscritos/em andamento/concluídos.

### Por que
`LibraryView.tsx` hoje (confirmar ao abrir) provavelmente é um acervo plano de itens, sem estrutura
de módulo/aula nem liberação progressiva. Isso é uma reforma grande — **candidata a ser quebrada em
subfases** (10a: estrutura de dados módulo/aula; 10b: editor de blocos; 10c: liberação
sequencial/agendada; 10d: métricas de progresso) em vez de uma sessão só.

### Estado atual
- Confirmado por grep: não há tabelas `modules`/`lessons`/`courses` no schema atual.
- `ai_generations`/buckets `library` já existem e podem ser reaproveitados para armazenar mídia de
  aula.

### O que fazer (visão geral — detalhar por subfase ao implementar)
- `courses` (reaproveitando ou estendendo a tabela de conteúdo existente, se `LibraryView` já
  tiver uma tabela de "content items" — **ler o código de `LibraryView.tsx` e a tabela que ele usa
  antes de decidir entre estender ou criar do zero**), `course_modules`, `course_lessons`
  (com `content_blocks JSONB` para o corpo em blocos, `release_mode 'immediate'|'sequential'|'scheduled'`,
  `scheduled_at` por aula), `course_enrollments` (`user_id`, `course_id`, `status`, `progress_pct`).
- Editor de blocos: pode começar simples (array de blocos tipados em JSON, renderizado por um
  switch de componentes) sem precisar de uma lib de rich-text completa — avaliar custo/benefício
  de usar algo como Tiptap/Slate vs. um editor de blocos caseiro mais simples, dado que o padrão
  do projeto é "sem dependências desnecessárias".
- Lógica de liberação sequencial: aula N só fica acessível se aula N-1 foi marcada como concluída
  pela paciente.
- Lógica de agendamento: aula com `scheduled_at` no futuro aparece bloqueada com data de liberação
  visível.

### Critérios de aceite
- Nutricionista cria um curso com 2 módulos e 3 aulas cada, define liberação sequencial, e uma
  paciente só acessa a aula 2 depois de concluir a aula 1.
- Métricas de inscritos/em andamento/concluídos batem com o comportamento real de uso.

### Como testar
1. Criar curso completo end-to-end como admin.
2. Como paciente, tentar pular aula fora de ordem (deve bloquear se sequencial).
3. Testar um curso com liberação agendada, confirmar que aula futura fica bloqueada até a data.

### Prompt para abrir em outro chat
```
Implemente a FASE 10 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Biblioteca → motor de cursos) no
repositório meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro, e leia por completo
app/admin/views/LibraryView.tsx e a(s) tabela(s) que ele usa hoje ANTES de decidir se cria tabelas
novas do zero ou estende as existentes. Esta é uma fase grande — se o escopo completo não couber
numa sessão, implemente e entregue a subfase 10a (estrutura de dados módulo/aula + CRUD básico no
admin, sem editor de blocos nem liberação sequencial ainda) e me diga claramente o que ficou de
fora para as próximas sessões, em vez de entregar algo incompleto sem avisar. Ao final rode
npx tsc --noEmit, corrija erros, e avise que está pronto para revisão antes de commitar.
```

---

## FASE 11 — Programas (pacotes vendáveis multi-item)

### Objetivo
Permitir que a nutricionista monte múltiplos pacotes pagos distintos (ex: "Programa Emagrecimento",
"Programa Pós-parto"), cada um agrupando um conjunto de protocolos/desafios/conteúdos específicos,
com preço e forma de cobrança próprios (única ou recorrente).

### Por que
Hoje a monetização do VitaClub é baseada em `tenants.plan_tier`/`profiles.current_plan` — um nível
de assinatura por tenant, não N produtos independentes que o profissional pode compor e vender
separadamente. Isso é uma mudança de modelo de negócio, não só uma feature — **exige alinhamento
de produto antes de qualquer código**, mas o trabalho de unificação de catálogo já feito
(`products`, migration `20260703000003_unify_product_catalog.sql`, Seção 16 do `CLAUDE.md`) é
provavelmente a base certa para isso, em vez de recomeçar do zero.

### Estado atual
- `products` já existe como catálogo unificado (pós-unificação de `gateway_products`).
- Não há hoje um conceito de "programa" que agrupe protocolo + desafio + conteúdo sob um único
  produto vendável com controle de acesso por item.
- `lib/services/productCatalog.ts` já existe como camada de adaptação — **ler esse arquivo por
  completo antes de desenhar a solução**, para entender exatamente o que `products` já modela hoje.

### O que fazer (alto nível — só avançar após validar a premissa de negócio com o dono do produto)
- Avaliar se "programa" vira um `product` com um novo campo `bundle_items JSONB` (lista de
  `{ item_type: 'protocol'|'challenge'|'content', item_id }`) em vez de uma tabela nova — mais
  simples e alinhado com o catálogo já unificado.
- Cada protocolo/desafio/conteúdo passa a ter um campo `access_type 'free' | 'program'` e, se
  `'program'`, referência a qual(is) produto(s) o desbloqueiam.
- No checkout Stripe existente, ao confirmar pagamento de um "programa", liberar acesso a todos os
  itens do `bundle_items` para aquele paciente (provavelmente via `protocol_assignments` +
  equivalente para desafio/conteúdo).
- UI admin: nova tela ou extensão de `ProductsView.tsx` para montar o bundle (selecionar quais
  protocolos/desafios/conteúdos entram em cada programa).
- UI paciente: itens com `access_type = 'program'` aparecem visíveis mas bloqueados/"cadeado" até
  o programa correspondente ser adquirido.

### Critérios de aceite
- Nutricionista cria um programa com 1 protocolo + 1 desafio + 1 conteúdo, define preço recorrente
  mensal, publica.
- Paciente vê os itens bloqueados, compra o programa via Stripe, e imediatamente ganha acesso aos
  3 itens vinculados.

### Como testar
1. Fluxo completo de compra de um programa de teste (Stripe test mode) e confirmar liberação
   automática dos 3 tipos de item.
2. Confirmar que um item marcado como "gratuito" continua acessível sem compra.
3. Confirmar que cancelamento/expiração da assinatura do programa revoga o acesso corretamente
   (checar como isso já funciona hoje para `plan_tier` e replicar o mesmo mecanismo).

### Prompt para abrir em outro chat
```
Implemente a FASE 11 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Programas — pacotes vendáveis
multi-item) no repositório meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro, e leia por
completo lib/services/productCatalog.ts e a migration
supabase/migrations/20260703000003_unify_product_catalog.sql antes de desenhar qualquer coisa —
esta fase deve estender o catálogo de produtos já unificado, não recriar um sistema paralelo.
Esta é uma mudança de modelo de monetização, não só uma feature: antes de implementar, escreva um
resumo curto do plano de dados proposto (bundle_items em products, access_type por item) e me
apresente esse resumo antes de tocar em código, para eu confirmar a direção. Só depois de
confirmado, implemente. Ao final rode npx tsc --noEmit, corrija erros, e avise que está pronto
para revisão antes de commitar.
```

---

## FASE 12 — Débitos técnicos e melhorias pendentes já conhecidas

### Objetivo
Fechar itens que já estão documentados como pendentes na Seção 16 do `CLAUDE.md` e que não têm
relação direta com o vídeo de referência analisado, mas que valem ser resolvidos no mesmo ciclo de
evolução do produto. Tratar cada item abaixo como uma sub-tarefa independente (pode virar PRs
separados).

### Itens
1. **Botão de exportação CSV de pacientes** — o endpoint `/api/admin/export/patients` já existe e
   funciona, só falta um botão em alguma view do admin (`PatientsView.tsx` é o lugar óbvio).
   Esforço: trivial.
2. **Push notifications via FCM** — integração parcial, `device_tokens` existe mas o fluxo
   completo de envio/recebimento precisa ser finalizado e testado ponta a ponta.
3. **Converter `schema_ai_credits.sql` e `schema_scheduled_events.sql` em migrations numeradas** —
   são hoje a única documentação de tabelas ativas em produção sem migration formal
   (`ai_credits`, `scheduled_events`, `content_templates`). Criar migrations idempotentes
   (`CREATE TABLE IF NOT EXISTS`) que apenas formalizem o que já existe, sem alterar dados.
4. **Ampliar cobertura de testes automatizados** — hoje cobre gamificação, ai-security e
   rate-limiter (conforme Seção 16). Priorizar testes para as fases novas deste roadmap conforme
   forem sendo implementadas (especialmente Fase 5 — prontuário — pelo risco de vazamento de dados
   clínicos entre tenants/pacientes, e Fase 9 — colaboradores — pelo risco de escalonamento de
   privilégio).
5. **Decisão de produto pendente: unificar `ProductsView`/`ProductGatewayView`** — mencionado como
   em aberto na Seção 16. Vale revisitar isso junto da Fase 11 (Programas), já que são áreas
   adjacentes.
6. **Limpeza gradual dos ~975 problemas de lint (`no-explicit-any` / variáveis não usadas)** —
   descoberto em 2026-07-07: `eslint.config.mjs` estava num formato (flat config, API do ESLint 9)
   incompatível com o `eslint@^8.56.0` fixado no `package.json`, então `npm run lint` nunca
   funcionou de verdade nesse projeto (falhava com erro de resolução de módulo, ou pedia setup
   interativo via `next lint`). Foi substituído por `.eslintrc.json` no formato legado compatível
   (`{"extends": ["next/core-web-vitals", "next/typescript"]}`), que é o único fix aplicado por
   ora. Ao rodar de verdade pela primeira vez, o lint acusou 906 erros e 69 avisos — quase todos
   `@typescript-eslint/no-explicit-any` e `no-unused-vars`, espalhados por handlers, hooks e pelas
   Edge Functions em Deno (`supabase/functions/*`). São questões de tipagem/estilo, não bugs
   funcionais (`npx tsc --noEmit` está limpo, 0 erros). Não corrigir tudo de uma vez — arriscado
   demais mexer em dezenas de arquivos ao mesmo tempo, especialmente Edge Functions que não dá
   pra testar em runtime neste ambiente. Ao tocar em qualquer arquivo por outro motivo (nas fases
   1–11 ou em manutenção normal), rode `npx eslint <arquivo>` nele e corrija o que aparecer ali,
   reduzindo o total aos poucos. Rodar `npx eslint .` periodicamente para acompanhar a contagem
   total baixando.
7. **Link de redefinição de senha sendo invalidado por scanners de e-mail** — descoberto em
   2026-07-07 ao investigar um caso real de "senha não funciona" da própria dona da conta. Os logs
   de auth do Supabase (`get_logs`, serviço `auth`) mostram o endpoint `/verify` do link de
   recuperação sendo acessado várias vezes em poucos segundos por IPs diferentes da infraestrutura
   do Google logo após cada envio de e-mail de recuperação — padrão típico de um scanner de
   segurança (Gmail Safe Browsing / gateway corporativo) pré-carregando o link antes do clique
   real da pessoa. Como o token de recuperação da Supabase é de uso único, o scanner acaba
   "queimando" o link antes (ou na corrida com) o clique real, causando erro de link
   inválido/expirado de forma intermitente. Confirmado que **não é** bug de resolução de papel
   (`role`): tanto `profiles.role` quanto `auth.users.raw_user_meta_data` já estavam corretos
   (`admin`) para a conta afetada, e a RLS de `profiles` permite a leitura do próprio perfil sem
   problema — então o mecanismo de decidir `/admin` vs `/patient/home` em `app/auth/callback/route.ts`
   e em `app/auth/reset-password/page.tsx` não é, sozinho, a causa raiz. Correção recomendada:
   trocar o fluxo de link mágico (GET que consome o token ao ser carregado) por um fluxo de código
   OTP de 6 dígitos que a pessoa digita manualmente (`supabase.auth.verifyOtp` com `type: 'recovery'`
   e um código enviado por e-mail em vez de um link clicável) — imune a pré-carregamento automático,
   já que scanners não digitam códigos. Envolve mudar `resetPasswordForEmail`/template de e-mail nas
   duas telas de login (`app/login/nutricionista/page.tsx`, `app/login/paciente/page.tsx`) e as duas
   telas de reset (`app/admin/reset-password/page.tsx`, `app/auth/reset-password/page.tsx`) —
   avaliar nessa hora se ainda faz sentido ter duas telas de reset separadas ou se dá pra unificar
   em uma só que decida o destino pelo `role`, já que a duplicação hoje é uma fonte extra de
   confusão. Enquanto isso não é implementado, contornar caso a caso resetando a senha diretamente
   via SQL (`update auth.users set encrypted_password = crypt('nova_senha', gen_salt('bf')) where
   id = '...'` — usa a extensão `pgcrypto`, já habilitada no projeto) quando alguém ficar travada.

### Como testar cada item
- Item 1: clicar no botão, confirmar download do CSV com dados corretos.
- Item 2: enviar uma notificação push de teste e confirmar recebimento em device real.
- Item 3: aplicar a migration nova em um ambiente limpo e confirmar que o schema resultante bate
  exatamente com o que está documentado nos arquivos legados.
- Item 4: rodar a suite de testes e confirmar cobertura das novas áreas críticas.
- Item 6: rodar `npx eslint .` antes e depois de cada lote de correções e confirmar que a contagem
  total de problemas caiu (não só mudou de arquivo).
- Item 7: solicitar um link de recuperação, checar os logs de auth do Supabase (`get_logs`,
  serviço `auth`) para confirmar que não há mais múltiplos acessos a `/verify` vindos de IPs
  diferentes antes do clique real; testar o novo fluxo OTP de ponta a ponta nas duas telas de
  login.

### Prompt para abrir em outro chat
```
Implemente o item [N] da FASE 12 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md no repositório
meu-club-nutri-ia (débitos técnicos pendentes). Leia o CLAUDE.md inteiro primeiro, especialmente a
Seção 16 (Próximos Passos Conhecidos), que documenta o contexto de cada um desses itens. Trate
apenas o item [N] indicado, não os outros da lista. Ao final rode npx tsc --noEmit, corrija erros,
e avise que está pronto para revisão antes de commitar.
```
(Substitua `[N]` pelo número do item específico ao usar este prompt.)

---

## FASE 13 — Desafio: mecanismo de participação e conclusão de atividade

### Objetivo
Construir a experiência de "jogar um desafio" que hoje não existe: a paciente conseguir entrar
num desafio, ver as missões do dia, concluí-las com prova (câmera/galeria/sem foto, mesmo padrão
da Fase 4/Hábitos) e ganhar pontos que realmente alimentam o ranking.

### Por que
Surgiu como desdobramento da Fase 4 (2026-07-09): o pedido original era "dar pontuação
diferenciada por tipo de comprovação em atividades de desafio/protocolo", mas investigação
mostrou que o lado Desafio não tem *nenhum* mecanismo de conclusão de atividade para diferenciar
— não é uma melhoria pontual, é uma feature inteira faltando.

### Estado atual (confirmado em 2026-07-09)
- Não existe em lugar nenhum do código um INSERT em `challenge_participants` — ou seja, não há
  fluxo de "participar de um desafio" no app da paciente hoje.
- `challenge_participants.score` (INTEGER DEFAULT 0) existe no schema mas nunca é escrito por
  nenhum código — é campo morto.
- `app/admin/desafios/builder/page.tsx` já monta uma estrutura de "missões por dia"
  (`rewards_json.days[].missions[]`, cada mission com `id`, `type`, `title`, `description`,
  `points`, `isBonus`), mas isso é **puramente decorativo** hoje: nenhuma tela da paciente lê
  `rewards_json.days`, então as missões criadas pelo admin nunca aparecem para ninguém.
- O ranking de desafio (`/api/patient/ranking`, aba Ranking do feed) já existe e funciona, mas
  usa `habit_logs` (Hábitos, sistema à parte) como proxy de desempate — não lê nada de missão de
  desafio de verdade.
- Confirmar de novo antes de implementar (pode ter mudado): `grep -rn "challenge_participants" app/`
  para achar se algum PR paralelo já criou um fluxo de join.

### O que fazer
**Migration**
- Nova tabela `challenge_progress` (`id`, `challenge_id`, `user_id`, `tenant_id`, `mission_id`
  TEXT — os ids de mission são strings geradas no client, não UUIDs de tabela —, `day_number`,
  `proof_type` `'simple'|'camera'|'gallery'`, `photo_url`, `points_earned`, `completed_at`),
  `UNIQUE(challenge_id, user_id, mission_id)` para não permitir completar a mesma missão 2x.
- Estender o formato de mission em `rewards_json.days[].missions[]` para ter 3 valores de pontos
  (`points_simple`/`points_gallery`/`points_camera` em vez de `points` único) — é JSONB, não
  precisa migration de schema, só mudar o shape gravado pelo builder.

**Backend**
- `POST /api/patient/challenges/[id]/join` — cria a linha em `challenge_participants` (idempotente,
  ignora se já existe).
- `GET /api/patient/challenges/[id]/today` — retorna as missões do dia corrente do desafio (a
  partir de `rewards_json.days[dayIndex]`) + quais já foram concluídas pelo usuário
  (`challenge_progress`).
- `POST /api/patient/challenges/[id]/complete` — recebe `mission_id`, `proof_type`, `photo_url`;
  resolve pontos a partir da definição da mission (nunca do client, mesmo cuidado da Fase 4);
  insere em `challenge_progress`; `awardPoints`; **e agora sim** faz
  `UPDATE challenge_participants SET score = score + pontos WHERE ...` — primeira escrita real
  desse campo.

**Frontend**
- Nova tela/aba no app da paciente (ex: dentro do card do desafio na aba Ranking do feed, ou uma
  rota própria) com: botão "Participar" quando ainda não é participante, lista de missões do dia
  com os mesmos 3 botões de prova da Fase 4 (toque simples / galeria / câmera).
- Reaproveitar bucket `protocol-photos` ou criar `challenge-photos` seguindo a mesma policy —
  avaliar ao implementar qual faz mais sentido (fotos de desafio e de protocolo são conceitualmente
  diferentes, mas a estrutura de policy é idêntica).

### Critérios de aceite
- Paciente consegue entrar num desafio ativo e ver as missões do dia corrente.
- Completar uma missão com prova dá mais pontos que sem prova, de forma auditável.
- `challenge_participants.score` reflete a soma real de pontos ganhos, e o ranking existente passa
  a refletir isso de verdade (hoje `score` sempre aparece 0 porque nunca é escrito).

### Como testar
1. Como paciente de teste, entrar num desafio ativo, completar 2-3 missões com provas diferentes.
2. Conferir que `challenge_participants.score` da paciente aumentou de acordo.
3. Conferir que a aba Ranking do feed reflete a pontuação real (hoje mostraria sempre 0).

### Prompt para abrir em outro chat
```
Implemente a FASE 13 do docs/ROADMAP_EVOLUCAO_PLATAFORMA.md (Desafio: participação e conclusão de
atividade) no repositório meu-club-nutri-ia. Leia o CLAUDE.md inteiro primeiro, e leia a seção
"Status" da Fase 4 e esta Fase 13 por completo antes de começar — elas documentam por que isso
virou uma fase própria e o que já foi confirmado sobre o estado atual (challenge_participants.score
morto, rewards_json.days como estrutura de missões nunca consumida pela paciente). Antes de criar
qualquer coisa, rode grep -rn "challenge_participants" app/ para confirmar que ninguém implementou
um fluxo de join em paralelo. Esta é uma feature grande — se não couber numa sessão, entregue e
avise claramente o que ficou de fora. Ao final rode npx tsc --noEmit, corrija erros, e avise que
está pronto para revisão antes de commitar.
```

---

## Notas finais

- Este roadmap nasceu da análise de um material de referência de uma plataforma concorrente de
  comunidades de saúde/nutrição (vídeo + transcrição), comparado feature a feature com o estado
  real do código do VitaClub em 2026-07-07. As seções "Estado atual" foram verificadas diretamente
  no repositório sempre que possível; onde não foi possível verificar em profundidade, isso está
  marcado explicitamente para ser confirmado antes de implementar.
- Fases marcadas 🟢 Baixa prioridade (9, 10, 11) envolvem mudanças de modelo de dados ou de
  monetização maiores — vale validar com o dono do produto antes de investir tempo de engenharia,
  mesmo que tecnicamente estejam bem especificadas aqui.
- Sempre que uma fase mencionar "confirmar antes de implementar", trate isso como bloqueante: um
  chat novo implementando essa fase deve investigar primeiro e só depois agir, não assumir.
