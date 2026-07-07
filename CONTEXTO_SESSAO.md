# Contexto da Sessão — Análise Competitiva + Próximos Passos

> Gerado em 22/06/2026 — para continuar no próximo chat

---

## O que foi analisado

Comparamos VitaClub com dois concorrentes:
- **mydose** (mydoseapp.com) — SaaS moderno, branco, comunidades de saúde
- **webdiet** — plataforma de nutrição legada, layout split-screen

---

## Decisões tomadas

### Prioridade 1 — Login com Google (OAuth)
- Supabase suporta nativamente
- Reduz atrito de cadastro
- mydose já tem, nós não

### Prioridade 2 — Split-screen no login com prova social
- Banner esquerdo: depoimento/foto de paciente, stats do clube, nome+foto da nutricionista
- Já temos Login Designer (`SettingsLoginView.tsx`), só precisamos expandir o layout

### Prioridade 3 — Onboarding Wizard (4 steps) — PRINCIPAL TAREFA
O mydose tem um wizard de 4 etapas quando o profissional cria a conta.
VitaClub não tem — a nutricionista entra no admin perdida, sem direção.

---

## Especificação do Onboarding Wizard

**Trigger:** `profiles.onboarding_completed = false` na primeira entrada no `/admin`
**Implementação:** Modal overlay no `AdminClientPage.tsx`
**Campo de controle:** `tenants.settings.onboarding_completed` ou `profiles.onboarding_completed`

### Step 1 — "Vamos criar o seu clube"
- Campo: Nome do clube (`tenants.name`)
- Campo: Nome do método (`tenants.method_name`)
- Campo: Cor principal — color picker com 8 opções predefinidas (`tenants.brand_color`)

### Step 2 — "A identidade do seu clube"
- Upload de logo (`tenants.logo_url`) — bucket `logos`
- Campo: Tagline/slogan (salvar em `tenants.settings.tagline`)
- **Preview em tempo real** do card de login que as pacientes verão (WOW moment)

### Step 3 — "Como você trabalha?"
- Tom da IA: acolhedora / motivadora / técnica (salvar em `tenants.settings.ai.tone`)
- Restrições alimentares atendidas: multiselect (salvar em `tenants.settings.dietary_focus`)
- Número esperado de pacientes: faixa (1-10 / 11-30 / 31-100 / 100+)

### Step 4 — "Tudo pronto! Seu clube está no ar 🎉"
- Animação de celebração (confetti ou Framer Motion)
- Link de convite para pacientes (`/vender/[slug]`)
- 3 próximos passos sugeridos:
  1. Criar primeiro protocolo → navega para ProtocolsView
  2. Adicionar primeira paciente → navega para PatientsView
  3. Personalizar a IA → navega para AISettingsView
- Marcar `onboarding_completed = true` no profiles + salvar tudo no tenant

---

## Nossa vantagem vs. mydose no onboarding

No Step 2, mostrar preview **ao vivo** da página de login personalizada enquanto a nutricionista digita o nome e escolhe a cor. Isso é diferencial real — mydose não consegue fazer isso porque não é white-label.

---

## Arquivos relevantes para implementar

```
/app/admin/AdminClientPage.tsx          ← Adicionar lógica de onboarding + modal
/app/admin/views/SettingsLoginView.tsx  ← Referência para o preview de login
/app/admin/views/SettingsView.tsx       ← Referência para salvar settings do tenant
/app/api/admin/                         ← APIs para salvar dados do wizard
/lib/hooks/useDatabase.ts               ← Hook useTenant para carregar/salvar
```

## Como checar se onboarding está pendente

```typescript
// Em AdminClientPage.tsx, após carregar o perfil:
const needsOnboarding = !profile?.onboarding_completed

// Ou via tenant:
const needsOnboarding = !tenant?.settings?.onboarding_completed
```

---

## Branch de trabalho

`claude/upbeat-cray-j18h6l` no repo `agendanutrijulianamoreira-droid/meu-club-nutri-ia`

---

## Stack lembrete

- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Framer Motion
- Supabase (auth + db + storage), Google Gemini 2.5 Flash
- Design escuro: `bg-slate-950`, `bg-indigo-600` para ações primárias
- **Nunca usar** `alert()`, `glass-panel`, `queen-pink`, `purple-600` em botões
- Commits em PT-BR: `feat: descrição`
