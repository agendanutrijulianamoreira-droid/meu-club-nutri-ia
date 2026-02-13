# 👑 REINO DA NUTRI - Product Requirements Document (PRD)

## Visão Geral
Sistema SaaS completo para gestão de Clubes de Assinatura de Nutrição, com foco em gamificação, automação e retenção.

---

## 🎯 Público-Alvo

### B2C (Pacientes/Rainhas)
- Mulheres que buscam emagrecimento sustentável
- Precisam de acompanhamento diário sem consultas frequentes
- Valorizam pertencimento e comunidade

### B2B (Nutricionistas)
- Profissionais que querem escalar atendimento
- Precisam de ferramentas de marketing e gestão
- Buscam sistema pronto para vender

---

## 📱 MÓDULO 1: App da Paciente (Mobile-First)

### Tela 1: HOJE (Dashboard Principal)
- Saudação personalizada: "Olá, Rainha [Nome]!"
- **Missão do Dia** (1 ação principal destacada)
- **Metas do Dia** (2-3 tarefas simples: água, proteína, fibra)
- Botão único: "Concluí!" com confete
- Barra de progresso do dia
- **Regra:** Um dia bom cabe em 90 segundos de app

### Tela 2: TEMPORADA (Calendário)
- Calendário visual do mês (dias marcados)
- Semana atual com "Boss Fight" (desafio especial)
- Ranking mensal (opcional, não invasivo)
- Contador de sequência (streak)

### Tela 3: REINO (Conteúdo)
- Trilhas guiadas (não biblioteca solta)
- Protocolo ativo do mês
- Desafio ativo da semana
- Arsenal: receitas, shots, listas

### Tela 4: EVIDÊNCIAS (Galeria)
- Fotos dos check-ins
- Vitórias registradas
- Antes/Depois (opcional)

### Tela 5: CHAT IA
- Botões rápidos de ação
- IA responde apenas sobre o clube
- Detecta padrões e sugere consulta
- Memória de contexto (nome, restrições, protocolo ativo)

### Gamificação
- Sistema de XP (pontos por ação)
- Badges de conquista
- Ranking mensal (reset dia 01)
- Recompensas por consistência (7/14/21 dias)
- "Modo Resgate" quando some 3 dias

---

## 🖥️ MÓDULO 2: Painel Admin (Desktop)

### Dashboard
- Métricas: alunas ativas, engajamento, inadimplência
- Alertas: quem sumiu, quem está brilhando
- Funil de conversão para consulta

### Planejador de Conteúdo
- **Calendário Anual** drag-and-drop
- Criar/Editar Protocolos
- Criar/Editar Desafios
- Definir tarefas diárias

### Editor de Protocolo
- Nome e duração
- Descrição
- Lista de dias com tarefas
- Gerador de conteúdo com IA

### Gestão de Alunas
- Lista com status (ativa, risco, pausada, cancelada)
- Último acesso
- Progresso no desafio atual
- Histórico de pagamentos

### Gestão Financeira
- Cobranças da anuidade
- Status de pagamento
- Recuperação automática
- Split de pagamento (para B2B)

### Configurações do Clube
- Nome e logo
- Cores da marca
- Prêmios mensais
- Links de venda

---

## 🧠 MÓDULO 3: IA Assistente

### Nutri Sábia (Chat)
- Responde dúvidas sobre protocolo ativo
- Sugere adaptações (dia corrido, comer fora)
- Usa linguagem do Reino
- Detecta padrões e sugere ação

### Assistente de Criação
- Gera estrutura de desafios
- Escreve descrições motivacionais
- Sugere tarefas diárias
- Cria copies para Instagram

---

## 💰 MÓDULO 4: Pagamentos

### Para Pacientes
- Link de cadastro + pagamento
- Checkout integrado
- Renovação automática

### Para B2B (Futuro)
- Split automático
- Dashboard financeiro por Nutri
- Taxas configuráveis

---

## 🏗️ ESTRUTURA TÉCNICA

### Stack
- **Frontend:** Next.js 14+ (App Router)
- **Estilo:** Tailwind CSS + Glassmorphism
- **Backend:** Supabase (Auth, DB, Storage, Edge Functions)
- **IA:** OpenAI API (GPT-4o)
- **Pagamentos:** Stripe ou Pagar.me

### Banco de Dados (Multi-tenant Ready)
```sql
-- Tenants (Clínicas/Nutricionistas)
tenants: id, name, slug, brand_color, logo_url, owner_id

-- Usuários
profiles: id, user_id, tenant_id, role, name, avatar_url, objective

-- Conteúdo
protocols: id, tenant_id, title, description, duration_days, is_active
challenges: id, tenant_id, title, description, start_date, duration_days
daily_tasks: id, protocol_id OR challenge_id, day_number, title, type, points

-- Progresso
user_progress: id, user_id, task_id, status, proof_url, completed_at
user_streaks: id, user_id, current_streak, longest_streak, last_checkin

-- Gamificação
badges: id, tenant_id, name, description, criteria_json, icon
user_badges: user_id, badge_id, earned_at
rewards: id, tenant_id, name, points_cost, description

-- Chat IA
chat_messages: id, user_id, content, sender, created_at, context_json

-- Pagamentos
subscriptions: id, user_id, plan_id, status, started_at, expires_at
payments: id, subscription_id, amount, status, paid_at
```

---

## 📅 ROADMAP

### FASE 1: MVP "Casa Própria" (3-4 semanas)
- [x] Setup Next.js + Supabase
- [ ] Auth simplificado (mock para dev)
- [ ] Painel Admin básico
- [ ] Cadastro de Protocolos e Desafios
- [ ] Planejador de Conteúdo
- [ ] App Paciente: Tela Hoje + Check-in

### FASE 2: Inteligência (2-3 semanas)
- [ ] Chat IA funcional
- [ ] Gerador de conteúdo com IA
- [ ] Sistema de XP e Badges
- [ ] Ranking mensal

### FASE 3: Retenção (2 semanas)
- [ ] Modo Resgate
- [ ] Notificações (push/email)
- [ ] Galeria de Evidências
- [ ] Vitórias e Conquistas

### FASE 4: Monetização (2 semanas)
- [ ] Integração de pagamentos
- [ ] Gestão de assinaturas
- [ ] Funil de upsell para consulta

### FASE 5: B2B Multi-tenant (Futuro)
- [ ] Onboarding de novas Nutris
- [ ] White-label (cores/logo)
- [ ] Split de pagamento
- [ ] Marketplace de templates

---

## 🎨 DESIGN SYSTEM

### Paleta "Reino Sábio"
- **Primária:** Rosa Rainha (#EC4899)
- **Secundária:** Dourado Coroa (#F59E0B)
- **Fundo:** Roxo Profundo (#0f0c29, #1a1744)
- **Texto:** Branco e Cinza Suave

### Tipografia
- Headers: Bold, impactful
- Body: Clean, legível

### Componentes
- Cards com Glassmorphism
- Botões com gradiente
- Micro-animações (confete, brilho)
- Ícones Lucide

---

## 📝 PRÓXIMO PASSO IMEDIATO

1. Refazer o schema do Supabase
2. Criar o Painel Admin funcional
3. Testar cadastro de protocolos
4. Depois: App da Paciente
