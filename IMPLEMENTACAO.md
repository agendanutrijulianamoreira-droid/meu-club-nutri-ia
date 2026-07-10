# NutriClub IA — Guia de Implementação

> Documento de controle de progresso. Cada fase é implementada em um chat separado.
> Ao concluir uma fase: marque o checklist, faça commit/push e inicie novo chat informando a fase.

---

## Status Geral

| Fase | Funcionalidade | Prioridade | Status |
|------|---------------|------------|--------|
| 1 | Diário Alimentar (TACO + meta) | CRÍTICA | ✅ Concluída |
| 2 | Gráficos de Progresso + Sintomas | CRÍTICA | ✅ Concluída |
| 3 | Notificações por Fase do REINO | ALTA | ✅ Concluída |
| 4 | Comunidade com Controle de Acesso | ALTA | ✅ Concluída |
| 5 | Scanner de Código de Barras | MÉDIA | ⬜ Pendente |
| 6 | Plano Alimentar por IA + REINO | ALTA | ⬜ Pendente |
| 7 | Reconhecimento de Alimento por Foto | MÉDIA | ⬜ Pendente |
| 8 | Relatório Pré-Consulta Automático | ALTA | ⬜ Pendente |

---

## ✅ FASE 1 — Diário Alimentar com Tabela TACO + Comparação de Meta

**O que foi implementado:**
- [x] Tabela `taco_alimentos` com índice full-text em português
- [x] Tabela `diario_alimentar` com RLS por paciente
- [x] Tabela `metas_paciente` com período de vigência
- [x] API `GET /api/alimentos/buscar?q=` — busca full-text na TACO
- [x] API `GET /api/patient/diario` — lista registros do dia
- [x] API `POST /api/patient/diario` — registra refeição
- [x] API `GET /api/patient/diario/historico` — histórico por período
- [x] Tela `/patient/diario` — diário do dia com refeições e totais
- [x] Tela `/patient/diario/adicionar` — busca + seleção + quantidade
- [x] Função `calcularAdesao` — consumido vs meta com status
- [x] Componentes: BarraProgresso, ResumoMacros

**Arquivos criados:**
- `supabase/migrations/20260214000001_taco_alimentos.sql`
- `supabase/migrations/20260214000002_diario_alimentar.sql`
- `app/api/alimentos/buscar/route.ts`
- `app/api/patient/diario/route.ts`
- `app/api/patient/diario/historico/route.ts`
- `app/patient/diario/page.tsx`
- `app/patient/diario/adicionar/page.tsx`
- `lib/utils/calcularAdesao.ts`

---

## ✅ FASE 2 — Gráficos de Progresso com Sintomas Subjetivos

**O que foi implementado:**
- [x] Tabela `checkin_diario` com 8 sintomas subjetivos (escala 0-10) + dados objetivos
- [x] RLS por paciente no checkin_diario
- [x] API `GET /api/patient/checkin-diario` — histórico para gráficos
- [x] API `POST /api/patient/checkin-diario` — registrar check-in do dia
- [x] API `GET /api/patient/diario/historico` — adesão alimentar por período
- [x] Tela `/patient/progresso` — 3 gráficos com seletor de período
- [x] Gráfico de Peso (LineChart — recharts)
- [x] Gráfico de Sintomas (multi-linha: Energia, Sono, Humor, Ansiedade, Inchaço)
- [x] Gráfico de Adesão (BarChart semanal)
- [x] SeletorPeriodo (7/30/90 dias)
- [x] Tela de check-in diário com validação de duplicata

**Arquivos criados:**
- `supabase/migrations/20260312000001_checkin_diario.sql` (parte da migration weekly_checkins)
- `app/api/patient/checkin-diario/route.ts`
- `app/patient/progresso/page.tsx`
- `app/patient/progresso/checkin/page.tsx`

---

## ✅ FASE 3 — Notificações Personalizadas por Fase do REINO

**O que foi implementado:**
- [x] Tabela `fase_paciente` — histórico de fases clínicas (1-6) com RLS
- [x] Tabela `preferencias_notificacao` — horários e opt-ins de push
- [x] Biblioteca de mensagens: 6 fases × 4 tipos = 24 conjuntos
- [x] Serviço FCM: `enviarPushFCM` + `enviarNotificacaoFase`
- [x] API `GET /POST /api/admin/patients/[id]/fase` — atribuir/consultar fase
- [x] API `GET /api/patient/fase-atual` — fase vigente da paciente autenticada
- [x] API `POST /api/admin/notificacoes/testar` — disparo de push de teste
- [x] Card de gestão de fase do REINO no painel de detalhe da paciente (admin)

**Arquivos criados:**
- `supabase/migrations/20260629000001_fase_paciente.sql`
- `lib/config/mensagensNotificacao.ts`
- `lib/services/notificacoesService.ts`
- `app/api/admin/patients/[id]/fase/route.ts`
- `app/api/patient/fase-atual/route.ts`
- `app/api/admin/notificacoes/testar/route.ts`

**Pendente (infra):**
- [ ] Rodar migration `20260629000001_fase_paciente.sql` no Supabase Dashboard
- [ ] Configurar `FCM_SERVER_KEY` nas variáveis de ambiente do Vercel
- [ ] Agendar cron job no Supabase para disparar notificações nos horários da paciente

---

## ✅ FASE 4 — Comunidade Dentro do App com Controle de Acesso

**O que foi implementado:**

### Banco de dados
- [x] Coluna `nivel_minimo` e `oculto` na tabela `community_posts`
- [x] Tabela `nivel_paciente` — nível atual da paciente com validade (1=Básico, 2=Plus, 3=VIP, 4=Consulta)
- [x] Tabela `comentarios_comunidade` — com campo `oculto` para moderação
- [x] Tabela `community_reactions` — reações por emoji (1 reação por paciente por post)
- [x] RLS: paciente só vê posts do seu nível ou inferior

### APIs (paciente)
- [x] `GET /api/patient/feed` — filtra por nível com lock visual para posts bloqueados
- [x] `POST /api/patient/feed` — criar post de texto
- [x] `POST /api/patient/feed/[id]/reagir` — reagir com emoji (toggle)
- [x] `GET /POST /api/patient/feed/[id]/comentar` — listar e criar comentários

### APIs (admin)
- [x] `GET /POST /api/admin/comunidade/posts` — listar posts + criar com nível de acesso
- [x] `PATCH /DELETE /api/admin/comunidade/posts/[id]` — ocultar/fixar/deletar post
- [x] `GET /api/admin/comunidade/comentarios` — listar comentários do tenant
- [x] `PATCH /api/admin/comunidade/comentarios/[id]` — ocultar comentário (toggle)
- [x] `GET /PUT /api/admin/patients/[id]/nivel` — consultar e definir nível da paciente

### Frontend (paciente)
- [x] Tela `/patient/feed` — feed com PostCard, LockedPostCard, CommentsSection, Ranking
- [x] Componente `LockedPostCard` com lock visual para posts de nível superior
- [x] Seção de comentários expansível por post
- [x] Emoji picker e reações em tempo real (otimístico)

### Frontend (admin)
- [x] `CommunityView.tsx` — criação de posts com seletor de nível mínimo, fixar, ocultar, deletar
- [x] Aba **"👥 Comunidade"** no perfil individual de cada paciente em `PatientsView.tsx`:
  - Exibição do nível atual com badge colorido
  - Painel para definir nível (Básico/Plus/VIP/Consulta) com data de validade
  - Lista de comentários da paciente com opção de ocultar individualmente

**Arquivos criados/modificados:**
- `supabase/migrations/20260629000002_comunidade_acesso.sql`
- `app/api/patient/feed/route.ts` ✏️
- `app/api/patient/feed/[id]/comentar/route.ts` ✏️
- `app/api/patient/feed/[id]/react/route.ts`
- `app/api/admin/comunidade/posts/route.ts` 🆕
- `app/api/admin/comunidade/posts/[id]/route.ts` 🆕
- `app/api/admin/comunidade/comentarios/route.ts`
- `app/api/admin/comunidade/comentarios/[id]/route.ts`
- `app/api/admin/patients/[id]/nivel/route.ts`
- `app/patient/feed/page.tsx` ✏️
- `app/admin/views/CommunityView.tsx` ✏️
- `app/admin/views/PatientsView.tsx` ✏️ (nova aba Comunidade)

**Pendente (infra):**
- [ ] Rodar migration `20260629000002_comunidade_acesso.sql` no Supabase Dashboard (se ainda não rodou)

---

## ⬜ FASE 5 — Scanner de Código de Barras com Avaliação Hormonal

**O que deve ser implementado:**

### Integração externa
- [ ] Integração com Open Food Facts API (pública, sem chave)
- [ ] `buscarProdutoPorEAN(ean)` — busca produto por código de barras

### Motor de avaliação
- [ ] `lib/config/ingredientesProblematicos.ts` — 5 categorias de risco:
  - `inflamatorios` (nível alto): açúcar, gordura trans, glutamato, etc.
  - `disruptores_hormonais` (nível alto): tartrazina, E102, nitrato, etc.
  - `estrogenicos` (nível médio): soja, isoflavona, etc.
  - `intestinais` (nível médio): carragena, polissorbato 80, E171, etc.
  - `glicemicos` (nível médio): maltodextrina, dextrose, amido modificado, etc.
- [ ] `avaliarProduto(ingredientes, faseAtual)` → semáforo verde/amarelo/vermelho
- [ ] Mensagem de avaliação contextualizada pela fase do REINO

### Banco de dados
- [ ] Tabela `cache_produtos_barcode` — cache de EANs já consultados (sem RLS)

### Frontend
- [ ] Botão "Escanear código de barras" na tela de adicionar alimento (Fase 1)
- [ ] Componente de câmera para leitura de EAN
- [ ] Tela de resultado: dados nutricionais + semáforo hormonal + alertas
- [ ] Botão "Adicionar ao diário" — integração com Fase 1

### Testes obrigatórios
- [ ] EAN de produto conhecido retorna dados corretos
- [ ] Segunda consulta do mesmo EAN usa cache (verificar no log)
- [ ] Produto com corante E102 → semáforo vermelho
- [ ] Produto com soja → semáforo amarelo + aviso fitoestrogênio
- [ ] EAN inexistente → mensagem clara (não quebra)
- [ ] Botão "adicionar ao diário" funciona com quantidade informada

---

## ⬜ FASE 6 — Plano Alimentar por IA Atrelado à Fase do REINO

**O que deve ser implementado:**

### Prompts clínicos
- [ ] `lib/config/promptsPlanoAlimentar.ts` — instruções por fase:
  - Fase 1 Anti-inflamatória: ômega-3, cúrcuma, evitar ultraprocessados
  - Fase 2 Intestinal: prebióticos, FODMAP, caldo de ossos
  - Fase 3 Hormonal: crucíferas, zinco, magnésio, detox estrogênico
  - Fase 4 Metabólica: baixo IG, timing nutricional, combinações proteína+fibra
  - Fase 5 Composição Corporal: ≥30g proteína/refeição, ciclagem de carbos
  - Fase 6 Manutenção: regra 80/20, autonomia alimentar

### Banco de dados
- [ ] Tabela `planos_alimentares` — com `status` (rascunho/aprovado/arquivado), `plano_json`, `fase_aplicada`

### APIs
- [ ] `POST /api/admin/patients/[id]/plano/gerar` — gera plano via Gemini (fase atual + restrições + metas)
- [ ] `PATCH /api/admin/patients/[id]/plano/[planoId]/aprovar` — nutri aprova rascunho
- [ ] `GET /api/patient/plano-atual` — plano aprovado da paciente autenticada

### Frontend (admin)
- [ ] Botão "Gerar plano" no painel da paciente
- [ ] Visualização do rascunho por dia/refeição com botão Aprovar
- [ ] Histórico de planos anteriores

### Frontend (paciente)
- [ ] Tela `/patient/diet` — plano da semana organizado por dia e refeição
- [ ] Lista de compras gerada pelo plano

### Testes obrigatórios
- [ ] Plano gerado para Fase 1 contém ômega-3 e evita açúcar refinado
- [ ] Plano com restrição "sem lactose" não contém leite/queijo/iogurte
- [ ] Status "rascunho" impede paciente de ver antes da aprovação
- [ ] Erro de API é capturado e exibido claramente

> **Nota:** O projeto usa Gemini 2.5 Flash (não Anthropic). Adaptar endpoint para `GEMINI_API_KEY`.

---

## ⬜ FASE 7 — Reconhecimento de Alimento por Foto (API Vision)

**O que deve ser implementado:**

### Upload
- [ ] Bucket `fotos-refeicao` no Supabase Storage
- [ ] `uploadFotoRefeicao(pacienteId, fotoBase64)` → URL pública

### Reconhecimento
- [ ] `reconhecerAlimentosPorFoto(fotoBase64)` via Gemini Vision (substituir GPT-4o do PDF)
- [ ] Retorno JSON: lista de alimentos com porção, calorias, confiança (alta/média/baixa)
- [ ] Fallback para busca manual se reconhecimento falhar

### Frontend
- [ ] Botão "Fotografar refeição" na tela `/patient/diario/adicionar`
- [ ] Tela de confirmação: paciente ajusta porções antes de salvar
- [ ] Integração com diário alimentar (Fase 1)

### Testes obrigatórios
- [ ] Foto de arroz e feijão retorna alimentos corretos
- [ ] Foto de baixa qualidade retorna confiança "baixa" (não quebra)
- [ ] Tela de confirmação permite remover alimento errado
- [ ] Fallback funciona quando API retorna erro

> **Nota:** O PDF cita GPT-4o Vision. Usar Gemini Vision (já na stack, sem custo adicional).

---

## ⬜ FASE 8 — Relatório Pré-Consulta Automático

**O que deve ser implementado:**

### Consolidação de dados
- [ ] `gerarRelatorioPreConsulta(pacienteId, diasAtras)` — agrega em paralelo:
  - checkins_diario (sintomas, peso)
  - diario_alimentar (adesão calórica)
  - perfil_clinico_paciente
  - metas_paciente vigentes
- [ ] Cálculo de métricas: taxa de adesão %, médias de sintomas, tendência de peso

### Análise clínica por IA
- [ ] `gerarAnaliseClinica(dados)` via Gemini — retorna análise em 4 seções:
  1. Resumo executivo (3 linhas)
  2. Pontos de atenção
  3. Evolução positiva
  4. Sugestões de conduta

### PDF
- [ ] Geração de PDF do relatório com branding Juliana
- [ ] Biblioteca: `@react-pdf/renderer` ou similar (confirmar o que já existe na stack)

### APIs
- [ ] `POST /api/admin/patients/[id]/relatorio/pre-consulta` — gera + salva relatório
- [ ] `GET /api/admin/relatorios/hoje` — lista relatórios das consultas do dia

### Frontend (admin)
- [ ] Tela na área admin: consultas do dia com botão "Ver relatório"
- [ ] Download do PDF gerado

### Automação (pós-implementação)
- [ ] Workflow no n8n: trigger 24h antes da consulta → chama API → salva relatório
- [ ] Notificação para Juliana quando relatório estiver disponível

### Testes obrigatórios
- [ ] Relatório com 30 dias de dados está correto
- [ ] Paciente com 0 registros gera relatório com aviso (não quebra)
- [ ] PDF gerado tem branding correto e dados legíveis
- [ ] Análise clínica é coerente com os dados fornecidos

---

## Checklist Universal (aplicar em toda fase antes de declarar concluída)

- [ ] Build/compilação sem erros (`npx tsc --noEmit`)
- [ ] RLS do Supabase testado (usuário A não vê dados do usuário B)
- [ ] Erros de API capturados e exibidos inline (não apenas no console)
- [ ] Nenhum `console.log` com dados sensíveis esquecido
- [ ] API keys NÃO estão hardcoded no código
- [ ] Commit feito com mensagem descritiva em português
- [ ] Push feito para a branch de trabalho
- [ ] Vercel build: Ready (sem erros de build)

---

## Notas de Adaptação (diferenças entre PDF e implementação real)

| PDF menciona | Projeto usa | Motivo |
|---|---|---|
| OpenAI GPT-4o Vision (Fase 7) | Gemini Vision | Já na stack, sem custo adicional |
| API Anthropic Claude (Fases 6 e 8) | Gemini 2.5 Flash | Já na stack (GEMINI_API_KEY configurada) |
| React Native / Expo Notifications | Next.js + FCM Web Push | Projeto é Next.js 14 web app |
| ReportLab para PDF | @react-pdf/renderer | ReportLab é Python; confirmar na Fase 8 |
| `relacao_nutri_paciente` (FK) | Multi-tenant via `tenants` table | Arquitetura real do projeto |

---

*Última atualização: Fase 3 concluída — 29/06/2026*
