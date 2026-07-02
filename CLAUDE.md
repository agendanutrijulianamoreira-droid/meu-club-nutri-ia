# VitaClub — Claude Code System Prompt

> Leia este arquivo inteiro antes de qualquer ação. Ele contém o estado atual do projeto, convenções de código, design system, arquitetura, regras de qualidade e instruções operacionais.

---

## 1. IDENTIDADE DO PROJETO

**VitaClub** é uma plataforma SaaS multi-tenant de saúde e nutrição voltada para nutricionistas independentes e seus grupos de pacientes. O produto é posicionado como "entry-level" com forte ênfase em comunidade, gamificação e automação por IA.

**Repositório:** `https://github.com/agendanutrijulianamoreira-droid/meu-club-nutri-ia.git`
**Supabase:** `https://antszuxeairmbctwuafo.supabase.co`
**Deployment:** Vercel

---

## 2. STACK TÉCNICA

| Camada | Tecnologia | Versão/Notas |
|---|---|---|
| Framework | Next.js 14 | App Router, Server Components onde possível |
| Linguagem | TypeScript | Strict mode parcial — não quebre o build |
| Estilização | Tailwind CSS | Classes utilitárias, sem CSS customizado |
| Componentes base | shadcn/ui | Importar de `@/components/ui/` |
| Animações | Framer Motion | `motion`, `AnimatePresence` |
| Banco de dados | Supabase (PostgreSQL) | RLS habilitado em todas as tabelas |
| Autenticação | Supabase Auth | JWT, cookies server-side |
| IA | Google Gemini 2.5 Flash (free tier) | Via `fetch` direto à API REST, env: `GEMINI_API_KEY` |
| Storage | Supabase Storage | Buckets: `logos`, `library`, `social-proof` |
| Edge Functions | Supabase Functions (Deno) | `agent-orchestrator`, `generate-menu`, `analyze-plate`, `send-push-campaign` |
| Pagamentos | Stripe | Não implementado ainda |
| Push | FCM (Firebase Cloud Messaging) | Via `device_tokens` table |

### Imports críticos
```typescript
// Supabase client-side
import { supabase } from "@/lib/supabase"
import { supabase } from "@/lib/supabase-browser" // em client components que precisam de realtime

// Supabase server-side (API routes, Server Actions)
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
const supabase = createSupabaseServerClient(cookies())

// Hooks de dados
import { useProtocols, useChallenges, useTenant } from "@/lib/hooks/useDatabase"
import { useStorage } from "@/lib/hooks/useStorage"

// Auth (Server Actions)
import { signOutAction } from "@/app/admin/actions/authActions"
import { updatePublicSetting } from "@/app/admin/actions/settingsActions"
```

---

## 3. ESTRUTURA DE PASTAS

```
/app
  /admin                    ← Painel da nutricionista (admin)
    /actions                ← Server Actions (authActions, settingsActions)
    /views                  ← Componentes de views do admin (um por seção)
    AdminClientPage.tsx     ← Shell principal do admin com navegação
  /api
    /admin                  ← APIs administrativas protegidas
      /patients             ← Lista + [id]/action
      /checkins             ← Lista + config
      /protocols-list       ← Listagem rápida para dropdowns
      /rewards              ← CRUD + [id] + seed
      /analytics            ← Dashboard analytics
      /community            ← Moderação do feed
      /dashboard            ← KPIs do admin
      /cron/trigger         ← Trigger manual do cron
    /ai
      /chat                 ← Chat streaming com a IA
      /generate             ← Geração de conteúdo (protocolos, desafios, copy)
      /meal-plan            ← Geração de plano alimentar
    /patient
      /feed                 ← Timeline social
      /store                ← Loja de recompensas
      /ranking              ← Ranking de XP
      /weekly-checkin       ← Submissão de check-in semanal
  /patient                  ← App da paciente (interface mobile-first)
    /checkin                ← Formulário de check-in semanal
    /feed                   ← Timeline social
    /store                  ← Loja de prêmios
  /vender/[slug]            ← Landing page de vendas pública
  /login                    ← Página de login com config dinâmica
/lib
  /hooks                    ← useDatabase, useStorage, useProfile...
  /services                 ← OnboardingService, etc.
  supabase.ts               ← Cliente Supabase browser
  supabase-browser.ts       ← Alias para components
  supabase-server.ts        ← createSupabaseServerClient
/supabase
  /functions                ← Edge Functions (Deno)
  /migrations               ← SQL migrations em ordem numérica
  schema_core.sql           ← Schema principal
  schema_extended.sql       ← Tabelas adicionais
```

---

## 4. DESIGN SYSTEM

### ❌ Proibido (legado — remover quando encontrar)
- `glass-panel` — classe CSS customizada inexistente no Tailwind
- `queen-pink` — cor customizada, não existe em produção
- `bg-[#0a0a16]`, `bg-[#131320]`, `bg-[#1a1744]` — cores hardcoded
- `purple-600` em botões primários — use `indigo-600`
- `alert()`, `confirm()` para feedback — use toast inline

### ✅ Paleta aprovada

| Uso | Classe |
|---|---|
| Fundo principal | `bg-slate-950` ou `bg-[#020617]` |
| Cards/seções | `bg-white/5`, `bg-white/[0.03]` |
| Bordas | `border-white/10`, `border-white/5` |
| Ação primária | `bg-indigo-600 hover:bg-indigo-500` |
| Sucesso/ativo | `text-emerald-400`, `bg-emerald-500/10` |
| Atenção | `text-amber-400`, `bg-amber-500/10` |
| Perigo/risco | `text-rose-400`, `bg-rose-500/10` |
| Texto primário | `text-white` |
| Texto secundário | `text-slate-400`, `text-slate-500` |
| Texto desabilitado | `text-slate-600`, `text-slate-700` |

### Componentes reutilizáveis padrão

**Toggle:**
```tsx
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-emerald-600' : 'bg-white/10'}`}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-0.5'}`}/>
    </button>
  )
}
```

**Toast inline (sem alert()):**
```tsx
const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
// Mostrar: setToast({ type: 'success', msg: 'Salvo!' })
// Auto-dismiss: setTimeout(() => setToast(null), 3500)
```

**Label de seção:**
```tsx
<p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Título da Seção</p>
```

**Botão primário:**
```tsx
<button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
```

**Card de item:**
```tsx
<div className="bg-white/5 border border-white/10 rounded-3xl p-5 group relative transition-all hover:border-indigo-500/30">
```

### Tipografia de badges/status
```tsx
// Badge padrão
<span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/25 text-emerald-400">
  Ativo
</span>
```

### Layout de views admin
- Sempre com `<div className="space-y-5 pb-10">` como container externo
- Header com h1 `text-3xl font-light` + span `font-bold` para segunda palavra
- Botão salvar no canto direito do header
- Toast logo abaixo do header
- Tabs: `bg-white/5 border border-white/10 rounded-2xl p-1 gap-1 w-fit`

---

## 5. BANCO DE DADOS

### Tabelas principais (schema_core.sql)

```sql
tenants           -- Clinicas/clubes (multi-tenant root)
profiles          -- Pacientes e admins (user_id = auth.users.id)
daily_logs        -- Registros diários (agua, refeição, protocolo)
protocol_assignments -- Protocolos atribuídos a pacientes
protocols         -- Templates de protocolos
weekly_checkin_responses -- Respostas semanais das pacientes
notifications     -- Inbox de cada usuária
subscriptions     -- Planos ativos
```

### Tabelas adicionais (schema_extended.sql)

```sql
challenges            -- Desafios gamificados
challenge_participants -- Participantes de desafios
reward_items          -- Catálogo de recompensas
reward_redemptions    -- Resgates de recompensas
community_posts       -- Posts do feed social
community_reactions   -- Reações aos posts
ai_generations        -- Log de gerações de IA
ai_cron_logs          -- Log de execuções do cron
```

### Campos críticos do `profiles`
```sql
user_id UUID                    -- FK para auth.users
tenant_id UUID                  -- FK para tenants
role TEXT                       -- 'patient' | 'admin' | 'nutritionist'
name TEXT
email TEXT
phone TEXT
current_plan TEXT               -- 'community' | 'tech_diet' | 'vip'
total_xp INTEGER DEFAULT 0
nutri_coins INTEGER DEFAULT 100
current_level INTEGER DEFAULT 1
current_streak INTEGER DEFAULT 0
longest_streak INTEGER DEFAULT 0
last_checkin_date DATE
primary_goal TEXT
initial_weight DECIMAL
current_weight DECIMAL
dietary_restrictions TEXT[]
onboarding_completed BOOLEAN
```

### Campos críticos do `tenants`
```sql
id UUID
name TEXT                       -- Nome do clube (brand_name no front)
slug TEXT UNIQUE                -- Para URL /vender/[slug]
brand_color TEXT
method_name TEXT
gpt_system_prompt TEXT          -- Prompt customizado da IA
logo_url TEXT
plan_tier TEXT                  -- 'free' | 'professional' | 'premium'
settings JSONB                  -- { ai: { tone, emojiLevel }, notifications: {}, checkin_config: {}, sales_page: {} }
```

### Padrão de query server-side
```typescript
// SEMPRE verificar auth e tenant antes de qualquer operação
const supabase = createSupabaseServerClient(cookies())
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const { data: tenant } = await supabase
  .from('tenants').select('id').eq('owner_id', user.id).single()
if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Padrão de query client-side (hooks)
```typescript
// Preferir hooks existentes em /lib/hooks/useDatabase.ts
const { protocols, loading, createProtocol, updateProtocol, deleteProtocol } = useProtocols()
// Os hooks já gerenciam estado local e evitam refetch desnecessário
```

---

## 6. MÓDULO DE IA

### Arquitetura de prompts

O sistema usa **3 camadas** de instrução:

```
┌─────────────────────────────────────────────────────────┐
│ CAMADA 1: gpt_system_prompt (tenant.gpt_system_prompt)  │
│ O método da nutricionista. Editável na UI.              │
│ Define: filosofia, restrições, abordagem, estilo        │
├─────────────────────────────────────────────────────────┤
│ CAMADA 2: Contexto operacional (gerado no route.ts)     │
│ Tom de voz (acolhedora/motivadora/técnica)              │
│ Nível de emoji (1-3)                                    │
│ Nome do clube, nome do método                           │
├─────────────────────────────────────────────────────────┤
│ CAMADA 3: Contexto da paciente (por request)            │
│ Nome, objetivo, peso, protocolo ativo, dia atual        │
│ Streak, XP, adesão 7d, check-in score, histórico       │
└─────────────────────────────────────────────────────────┘
```

### Endpoints de IA

| Endpoint | Uso | Modelo |
|---|---|---|
| `POST /api/ai/chat` | Chat em tempo real com paciente | gemini-1.5-flash (streaming) |
| `POST /api/ai/generate` | Gerar protocolo, desafio, copy | gemini-1.5-flash (JSON) |
| `POST /api/ai/meal-plan` | Gerar plano alimentar | gemini-1.5-flash (JSON) |
| Edge: `agent-orchestrator` | Mensagens automáticas diárias (cron) | Gemini REST API |
| Edge: `generate-menu` | Cardápio via Edge Function | Gemini REST API |

### Tarefas do endpoint `/api/ai/generate`

```typescript
// task: 'generate-protocol' → { title, description, days: [{ day, title, tasks }] }
// task: 'generate-challenge' → { title, description, emoji, duration_days }
// task: 'sales-copy' → { headline, subheadline, benefits[], cta }
// task: 'marketing-suggestion' → { title, message }
```

### Regras de IA

1. **Nunca hardcode respostas de IA** — toda sugestão/conteúdo deve chamar a API real
2. **Sempre inclua context rico** — nome da paciente, objetivo, streak, protocolo ativo
3. **Sempre trate erros** — mostre `aiError` inline, nunca `alert()`
4. **Estado de loading** — botão desabilitado + ícone Loader2 animando durante geração
5. **JSON mode** — use `responseMimeType: 'application/json'` para outputs estruturados
6. **Temperature** — 0.7 para conteúdo criativo, 0.3 para dados estruturados

---

## 7. VIEWS DO ADMIN — ESTADO ATUAL

Todas as views vivem em `/app/admin/views/`. O `AdminClientPage.tsx` faz o routing por `ViewType`.

| View | Arquivo | Status |
|---|---|---|
| Dashboard | `DashboardView.tsx` | ✅ Dados reais |
| Bio-Protocolos | `ProtocolsView.tsx` | ✅ Completo |
| Desafios | `ChallengesView.tsx` | ✅ Completo |
| Minhas Rainhas | `PatientsView.tsx` | ✅ Completo |
| Check-ins Inteligentes | `CheckinsView.tsx` | ✅ Completo |
| Loja de Recompensas | `RewardsView.tsx` | ✅ Completo |
| Biblioteca do Reino | `LibraryView.tsx` | ✅ Completo |
| Comunidade | `CommunityView.tsx` | ✅ Completo |
| Analytics | `AnalyticsView.tsx` | ✅ Completo |
| Comunicação | `CommunicationCenterView.tsx` | ✅ Completo |
| Plano do Clube | `ClubPlanView.tsx` | ✅ Completo |
| Página de Vendas | `SalesPageGenerator.tsx` | ✅ Completo |
| Laboratório IA | `AISettingsView.tsx` | ✅ Completo |
| Configurações | `SettingsView.tsx` | ✅ Completo |
| Login Designer | `SettingsLoginView.tsx` | ✅ Completo |

### Passagem de props entre AdminClientPage e Views
```tsx
// AdminClientPage passa as seguintes props para todas as views:
const props = { setView: setActiveView, userName, tenantName, tenantId }

// Views que precisam de tenantId (todas as que salvam dados):
export function XxxView({ setView, tenantId }: { setView: (v: any) => void; tenantId?: string })
```

---

## 8. APP DA PACIENTE

Interface mobile-first em `/app/patient/`. Todas as páginas são client components com design escuro e compacto.

### Páginas existentes
- `/patient/home` — Dashboard com streak, XP, checklist do dia
- `/patient/checkin` — Formulário de check-in semanal (diet_score, bowel, mood, had_binge, main_difficulty, extra_notes)
- `/patient/feed` — Timeline social com tabs Comunidade/Ranking
- `/patient/store` — Loja de prêmios com NutriCoins
- `/patient/diet` — Plano alimentar
- `/patient/chat` — Chat com IA

### Design da paciente
- Mobile-first: max-w 430px, padding `px-4`
- Bottom navigation: 5 itens com ícones
- Cards com `bg-slate-900/80 border border-white/10 rounded-3xl`
- Sticky headers com `bg-slate-950/90 backdrop-blur-xl`

---

## 9. CONVENÇÕES DE CÓDIGO

### TypeScript
```typescript
// Prefira interfaces explícitas para objetos de estado
interface PatientRow {
  id: string
  userName: string
  riskLevel: 'low' | 'medium' | 'high'
  // ...
}

// Use 'as const' para objetos de lookup
const RISK_META = {
  high: { label: 'Crítico', color: 'text-rose-400' },
  // ...
} as const

// Nunca use 'any' desnecessariamente — preferir 'unknown' ou tipo explícito
// Se precisar de escape hatch: 'as any' com comentário explicando por quê
```

### React
```typescript
// Preferir useState + fetch sobre useEffect + fetch para simplificar
// Usar useCallback para funções passadas como props ou em useEffect deps
// AnimatePresence sempre com mode="wait" para transições limpas
// Framer Motion: initial/animate/exit em todos os motion.div animados

// NUNCA use <form onSubmit> — use onClick nos botões
// NUNCA chame window.location — use Next.js router

// Estrutura padrão de uma view:
export function XxxView({ setView, tenantId = '' }: Props) {
  // 1. State
  // 2. Hooks de dados
  // 3. Effects
  // 4. Handlers (handleSave, handleDelete, etc.)
  // 5. Computed values (filtered, sorted, stats)
  // 6. Render com seções bem comentadas
}
```

### API Routes
```typescript
// Padrão obrigatório para todas as rotas admin:
export async function GET/POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Nunca confiar no tenant_id vindo do body — sempre resolver pelo user.id
  // Sempre validar que o recurso pertence ao tenant antes de modificar
}
```

### Mensagens e feedback
```
✅ Toast inline com auto-dismiss (3500ms)
✅ Estado de loading em botões (disabled + Loader2 animando)
✅ Estado vazio com empty state descritivo + CTA
✅ Confirmação antes de ações destrutivas (confirm() é aceitável para delete)
❌ alert() para qualquer feedback
❌ Spinner cobrindo tela inteira para operações menores
❌ Mensagem de sucesso sem auto-dismiss
```

---

## 10. GAMIFICAÇÃO — SISTEMA DE PONTOS

```
XP POR AÇÃO:
- Check-in diário completo (todas as 4 categorias): +30 XP
- Meta de hidratação (2L): +10 XP
- Meta de exercício registrada: +20 XP
- Check-in semanal enviado: +20 XP
- Completar desafio: +100 XP
- Streak 7 dias: +50 XP bonus
- Streak 14 dias: +75 XP bonus
- Streak 21/30/60/100 dias: +100/150/200/300 XP bonus

NUTRICOINS:
- 1 XP ≠ 1 NutriCoin (moedas são mais escassas)
- Ganho base: 1 NutriCoin por ação de check-in
- Bônus de streak: dobro nos marcos
- Resgate: sem reembolso parcial, cancelamento devolve 100%

NÍVEIS:
- Level 1: 0-499 XP
- Level 2: 500-1499 XP
- Level 3: 1500-2999 XP
- Level N: XP mínimo = (N-1)^2 * 500
```

---

## 11. MIGRATIONS E BANCO

### Ordem de execução das migrations
1. `20260312000001_weekly_checkins.sql`
2. `20260312000002_daily_engagement_cron.sql`
3. `20260313000001_community_feed.sql`
4. `20260313000002_feed_auto_posts.sql`
5. `20260313000003_reward_store.sql`

### Regras para novas migrations
- Nome: `YYYYMMDD000001_descricao_curta.sql`
- Sempre `IF NOT EXISTS` em CREATE TABLE
- Sempre `ON CONFLICT DO NOTHING` em INSERTs de seed
- Nunca DROP TABLE sem `IF EXISTS` e comentário explicativo
- Habilitar RLS em toda nova tabela
- Criar índices para todas as foreign keys

### Funções RPC disponíveis
```sql
seed_reward_items(p_tenant_id UUID)  -- Popula catálogo de recompensas de exemplo
```

---

## 12. EDGE FUNCTIONS & ORQUESTRA DE AGENTES

### Arquitetura de Agentes IA

O sistema usa um **Orchestrator** central que recebe eventos e despacha para agentes especializados. Todas as chamadas IA usam `fetch` direto à API Google Gemini 2.5 Flash (free tier).

**Tabelas de suporte:**
- `agent_logs` — log de execução de todos os agentes (debug, métricas, billing)
- `inbox_messages` — mensagens dos agentes para pacientes (Realtime habilitado)
- `patient_risk_scores` — score de risco diário por paciente

### `agent-orchestrator` (NOVO)
**Deploy:** `supabase/functions/agent-orchestrator/index.ts`
**Trigger:** Cron diário + chamada direta de outros webhooks
**Segredos:** `GEMINI_API_KEY`, `CRON_SECRET`, `FCM_SERVER_KEY`
**Eventos suportados:**
- `cron_daily` → roda Sabotage → Engagement → Retention → Protocol → Community → Upsell
- `checkin_submitted` → analisa risco pós-checkin
- `meal_logged` → feedback nutricional via Meals Agent
- `post_created` → auto-moderação via Community Moderation Agent
- `stripe_webhook` → dispara Onboarding para novos assinantes
- `manual` → execução manual de agente específico (payload: `{ agent: 'nome' }`)

**Agentes embutidos (9 total):**
| Agente | Função | Trigger |
|---|---|---|
| Sabotage Detection | Calcula risk scores 0-100 em 4 dimensões, detecta autossabotagem | cron_daily, checkin |
| Daily Engagement | Gera mensagens personalizadas baseado em risk scores | cron_daily |
| Onboarding | Boas-vindas em 3 etapas para novos assinantes | stripe_webhook |
| Meals | Feedback nutricional instantâneo ao registrar refeição (score + dica) | meal_logged |
| Retention | Win-back para pacientes sumidas 3+d, escala urgência, anti-spam 48h | cron_daily |
| Protocol | Detecta transições de fase (início/metade/fim/completou), auto-completa | cron_daily |
| Community | Gera 1 post inspiracional/dia adaptado ao dia da semana | cron_daily |
| Community Moderation | Auto-modera posts novos, flagga conteúdo impróprio, fail-open | post_created |
| Upsell Intelligence | Detecta momentos de upgrade (dias no clube, check-ins, engajamento) e propõe ofertas para aprovação em `agent_approval_queue` | cron_daily |

### `generate-menu`
**Deploy:** `supabase/functions/generate-menu/index.ts`
**Uso:** Geração de cardápio personalizado (migrado de OpenAI para Claude)

### `analyze-plate`
**Deploy:** `supabase/functions/analyze-plate/index.ts`
**Uso:** Análise de foto de prato via Claude Vision

### `send-push-campaign`
**Deploy:** `supabase/functions/send-push-campaign/index.ts`
**Uso:** Envio de campanhas push em massa via FCM

### Padrão de chamada IA em Edge Functions
```typescript
const res = await fetch(GEMINI_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Gemini API (free tier)
    
  },
  body: JSON.stringify({
    // Model: gemini-2.5-flash-preview-05-20
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  }),
})
const data = await res.json()
const text = data.content?.[0]?.text || ''
const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
const parsed = JSON.parse(clean)
```

---

## 13. PROMPT DA IA NUTRICIONISTA

O `gpt_system_prompt` é a alma do sistema. Está salvo em `tenants.gpt_system_prompt` e é editável pela nutricionista no Laboratório de Inteligência.

### Prompt padrão (fallback quando não configurado)

```
Você é a nutricionista virtual especializada do clube de saúde e bem-estar feminino. Seu papel é ser a companheira inteligente de cada mulher em sua jornada de transformação — presente nos bons dias, nos dias difíceis, nas dúvidas e nas conquistas.

IDENTIDADE E PROPÓSITO:
Você não é um chatbot genérico. Você é uma profissional de saúde personalizada, que conhece cada paciente pelo nome, respeita seu histórico, compreende suas dificuldades e celebra cada avanço, por menor que seja. Você opera sob um método estruturado de reeducação alimentar com abordagem biológica, comportamental e emocional integradas.

ABORDAGEM NUTRICIONAL — PRINCÍPIOS FUNDAMENTAIS:
Priorize sempre alimentos reais, minimamente processados e acessíveis no mercado brasileiro. Use comida de verdade: arroz, feijão, ovos, carnes magras, legumes, frutas da estação, tubérculos, oleaginosas e azeite. Evite recomendar alimentos importados, caros ou difíceis de encontrar, a menos que a paciente solicite. Nunca promova dietas extremamente restritivas — sem cortar abaixo de 1200 kcal sem supervisão médica, sem exclusão de grupos alimentares sem indicação clínica. A saciedade e o prazer alimentar são parte do protocolo. A inflamação silenciosa é o foco central: oriente reduzir ultraprocessados, açúcar refinado, farinhas brancas e óleos vegetais refinados como prioridade antes de qualquer restrição calórica.

SABEDORIA COMPORTAMENTAL E EMOCIONAL:
Reconheça que comer é um ato emocional, social e cultural — nunca culpe ou julgue. Quando uma paciente relata uma recaída ou compulsão, acolha, entenda o contexto e ajude a retomar — nunca critique. Identifique gatilhos como estresse, ansiedade, TPM e fadiga como fatores dietéticos legítimos que merecem estratégias concretas. O ciclo menstrual impacta apetite, retenção de líquidos e disposição — considere isso quando a paciente mencionar variações de humor, inchaço ou compulsão por doces. Ensine a diferença entre fome física e fome emocional de forma prática e sem julgamento.

PERSONALIZAÇÃO E GAMIFICAÇÃO:
Use ativamente o contexto da paciente — protocolo ativo, dia atual, streak, XP e adesão. Referencie o sistema de NutriCoins, missões e desafios de forma natural: "cada refeição registrada vale 30 XP", "você está a 3 dias de completar o desafio", "seu streak de 14 dias é uma conquista real". A gamificação transforma hábitos em identidade — reforce que cada ação conta.

SHOTS E PROTOCOLOS BIOATIVOS:
Recomende shots matinais como alavancas metabólicas: gengibre+limão+pimenta cayena para termogênese, cúrcuma+pimenta preta para inflamação, aloe vera+hortelã para o intestino. Sempre em jejum, 30-50ml, 20 minutos antes do café. Oriente quem deve evitar (gastrite, úlcera, anticoagulantes).

SEGURANÇA E LIMITES PROFISSIONAIS:
Nunca forneça diagnósticos médicos. Para sintomas físicos preocupantes (dores intensas, sangramento, febre persistente, sintomas gastrointestinais graves), oriente consultar um médico imediatamente. Não prescreva suplementos sem indicação clínica prévia. Para dúvidas sobre medicamentos, remeta sempre ao médico responsável.

COMUNICAÇÃO:
Responda em português brasileiro natural, caloroso e humano. Use o nome da paciente com frequência. Seja direta e prática — se ela pergunta o que comer, dê 3 opções concretas, não uma palestra. Máximo de 4 parágrafos curtos no chat. Para notificações e mensagens automáticas, máximo 3 frases. Redirecione gentilmente perguntas fora da área de saúde e nutrição.
```

### Como o prompt é usado em cada contexto

| Contexto | Como usa o gpt_system_prompt |
|---|---|
| Chat paciente | Como "INSTRUÇÕES ADICIONAIS DO MÉTODO" ao final do systemPrompt |
| Plano alimentar | Como base principal (`basePrompt`), concatenado com toneGuide |
| Daily engagement | Como `system` prompt direto para Claude |
| Agent orchestrator | Como base do `system` prompt de cada agente |
| Generate (protocolos/desafios/copy) | Como `baseInstructions` prefixado antes da instrução de task |
| generate-menu (Edge) | Como base principal da instrução |

---

## 14. REGRAS DE QUALIDADE DO CÓDIGO

### Antes de qualquer modificação
1. Leia o arquivo completo antes de editar
2. Entenda o contexto de uso (onde é renderizado, quais props recebe)
3. Verifique se existe hook dedicado antes de fazer query direta

### Ao criar nova view admin
1. Use o design system descrito na Seção 4
2. Passe `tenantId` via props (AdminClientPage já passa)
3. Adicione o case em AdminClientPage.tsx
4. Use toast inline, não alert()
5. Todo input de usuário deve ter `placeholder` descritivo
6. Estados vazios devem ter mensagem + CTA

### Ao criar nova API route
1. Sempre autenticar usuário E verificar tenant
2. Nunca confiar em tenant_id do body — resolver pelo owner_id
3. Retornar erros descritivos com status HTTP correto
4. Logar erros com `console.error('[NomeDaRota]', error)` 

### Ao modificar o banco
1. Nunca modificar schema_core.sql ou schema_extended.sql diretamente — criar migration
2. Testar SQL no painel Supabase antes de commitar
3. Migrations são unidirecionais — não faça rollback, faça nova migration

### TypeScript
1. Executar `npx tsc --noEmit` após mudanças e corrigir erros antes do commit
2. Erros comuns aceitáveis (suprimir com filtro): TS2307, TS7026, TS2503, TS7006, TS2580
3. Nunca usar `@ts-ignore` — preferir cast explícito com comentário

### Git
1. Commits em português com formato: `feat|fix|refactor: descrição concisa`
2. Body do commit deve listar todas as mudanças relevantes
3. Sempre `git push` após commit

---

## 15. VARIÁVEIS DE AMBIENTE

```bash
# .env.local (nunca commitar)
NEXT_PUBLIC_SUPABASE_URL=https://antszuxeairmbctwuafo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # Para criar usuários e operações admin
GEMINI_API_KEY=sua_chave    # Google Gemini (free: aistudio.google.com/apikey)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
FCM_SERVER_KEY=...              # Firebase Cloud Messaging (push)

# Supabase Edge Function Secrets (configurar no Dashboard)
GEMINI_API_KEY=sua_chave_gemini
CRON_SECRET=...
FCM_SERVER_KEY=...
SUPABASE_URL=...                # Auto-preenchido pelo Supabase
SUPABASE_SERVICE_ROLE_KEY=...   # Auto-preenchido pelo Supabase
```

### Helper IA compartilhado (Gemini): `lib/services/anthropic.ts`
```typescript
import { callClaude, callClaudeJSON, streamClaude, triggerOrchestrator } from '@/lib/services/anthropic'

// Texto simples
const text = await callClaude({ system: '...', messages: [...], maxTokens: 1000 })

// JSON tipado
const data = await callClaudeJSON<MyType>({ system: '...', messages: [...] })

// Streaming (Next.js Response)
const stream = streamClaude({ system: '...', messages: [...] })
return new NextResponse(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

// Fire-and-forget para orchestrator
triggerOrchestrator('checkin_submitted', tenantId, userId)
```

---

## 16. PRÓXIMOS PASSOS CONHECIDOS

- [x] Migração completa para Gemini 2.5 Flash free tier (100% concluída)
- [x] Orquestra de 9 agentes IA no orchestrator (incluindo Upsell Intelligence)
- [x] Dashboard admin de agentes (4 tabs: Overview, Agentes, Risco, Timeline)
- [x] Inbox da paciente com Realtime
- [x] Stripe webhook → Onboarding Agent
- [x] Triggers automáticos (checkin, meal, post)
- [x] Migration `20260320_agent_infrastructure.sql` aplicada (agent_logs, inbox_messages, patient_risk_scores ativas em produção)
- [x] Deploy `agent-orchestrator` (ACTIVE em produção)
- [x] pg_cron configurado (`cron_daily` às 12:00 UTC — job ativo, ver `cron.job`)
- [x] Função legada `daily-engagement` removida do repositório (o admin já usa só `agent-orchestrator`); a versão deployada no Supabase ainda precisa ser removida manualmente (`supabase functions delete daily-engagement` ou pelo dashboard — não há tool de delete disponível via MCP)
- [x] Escritas de notificação migradas para `inbox_messages` em todos os pontos do código
- [ ] Dropar a tabela `notifications` legada (mantida por segurança até validar em produção — zero escritas hoje)
- [ ] Push notifications via FCM (integração parcial — device_tokens existe)
- [ ] Exportação CSV de dados das pacientes
- [ ] Ampliar cobertura de testes automatizados (hoje: gamificação, ai-security, rate-limiter)
- [ ] Converter `schema_ai_credits.sql` e `schema_scheduled_events.sql` em migrations numeradas — são a única documentação de tabelas ativas sem migration formal (ver `supabase/legacy-manual-sql/README.md`)

---

## 17. COMANDOS ÚTEIS

```bash
# Dev local
npm run dev

# Type check (deve retornar 0 erros nos nossos arquivos)
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "TS2307\|TS7026\|TS2503\|TS7006\|TS2580"

# Commit padrão
git add -A && git commit -m "feat: ..." && git push

# Deploy Edge Functions
supabase functions deploy agent-orchestrator
supabase functions deploy generate-menu
supabase functions deploy analyze-plate
supabase functions deploy send-push-campaign

# Trigger manual do orchestrator (cron)
curl -X POST https://antszuxeairmbctwuafo.supabase.co/functions/v1/agent-orchestrator \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"cron_daily"}'

# Trigger manual de agente específico
curl -X POST https://antszuxeairmbctwuafo.supabase.co/functions/v1/agent-orchestrator \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"manual","tenant_id":"UUID","payload":{"agent":"sabotage"}}'

# pg_cron setup (rodar no SQL Editor do Supabase)
SELECT cron.schedule('daily-agents', '0 12 * * *',
  $$SELECT net.http_post(
    url := 'https://antszuxeairmbctwuafo.supabase.co/functions/v1/agent-orchestrator',
    headers := '{"x-cron-secret":"SEU_CRON_SECRET"}'::jsonb,
    body := '{"type":"cron_daily"}'::jsonb
  )$$
);
```

---

*Última atualização: Julho 2026 — VitaClub v1.0 com orquestra completa de 9 agentes IA*
