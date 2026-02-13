# 🎯 Meu Club Nutri.AI

Plataforma de nutrição gamificada com IA, sistema multi-tenant B2B2C com foco em retenção através de gamificação não-punitiva.

## ✨ Features

- 🎮 **Gamificação Completa**: NutriCoins, XP, Levels, Streaks
- 🤖 **Magic AI Generator**: Cardápios personalizados via GPT-4o
- 👥 **Multi-tenant**: Suporte para múltiplos nutricionistas (white-label)
- 🎨 **Design Premium**: Glassmorphism + Dark Mode
- 📱 **Mobile-First**: Interface otimizada para dispositivos móveis
- 🔐 **Autenticação**: Login seguro com Supabase Auth
- ⚡ **Realtime**: Atualizações em tempo real de moedas e progresso

## 🚀 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS + Framer Motion
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **IA**: OpenAI GPT-4o

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.local.example .env.local
# Edite .env.local com suas credenciais do Supabase

# Executar SQL no Supabase
# Copie o conteúdo de supabase/schema_core.sql
# Cole no SQL Editor do Supabase Dashboard

# Rodar servidor de desenvolvimento
npm run dev
```

## 🗄️ Banco de Dados

Execute o script SQL:
```bash
supabase/schema_core.sql
```

Isso irá criar:
- 5 tabelas principais (tenants, profiles, daily_logs, protocols, ai_generations)
- Row Level Security (RLS)
- Triggers de gamificação automática
- Views para ranking e dashboard
- Dados demo

## 🤖 Edge Function (IA)

Deploy da função de IA:

```bash
# Via Dashboard (recomendado)
# 1. Vá em: Database → Functions
# 2. Create new function
# 3. Cole o código de: supabase/functions/generate-menu/index.ts
# 4. Configure OPENAI_API_KEY nas Secrets
```

## 🔑 Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui
```

## 📖 Documentação

- `DOSSIE_MEU_CLUB_NUTRI_AI.md` - Visão geral completa do projeto
- `IMPLEMENTACAO_CORE.md` - Guia técnico dos componentes
- `GUIA_DASHBOARD.md` - Como usar o dashboard integrado
- `GUIA_LOGIN.md` - Configuração de autenticação
- `DIAGNOSTICO_API_KEY.md` - Troubleshooting de erros comuns

## 🎮 Principais Componentes

### Dashboard (`/dashboard`)
- `GamificationHeader` - Header com moedas animadas
- `DailyActionList` - Checklist diário com confetes
- `PanicButton` - SOS exclusivo para VIPs

### Onboarding (`/login`)
- Sistema de cadastro e login
- Seleção de tipo (Paciente/Nutri)
- Auto-criação de perfil

## 🤝 Estrutura do Código

```
app/
├── dashboard/          # Dashboard do paciente
├── login/             # Autenticação
├── auth/              # Server Actions
└── globals.css        # Estilos globais

components/
├── dashboard/         # Componentes do dashboard
├── onboarding/        # Fluxo de onboarding
└── ui/               # Design system

lib/
├── hooks/            # Hooks customizados (useProfile, useDailyLogs)
└── supabase.ts       # Cliente Supabase

supabase/
├── schema_core.sql   # Schema do banco
└── functions/        # Edge Functions
```

## 🎯 Roadmap

- [x] Banco de dados multi-tenant
- [x] Gamificação automática
- [x] Magic AI Generator
- [x] Dashboard integrado
- [x] Sistema de autenticação
- [ ] Upload de fotos
- [ ] Chat com IA
- [ ] Ranking mensal
- [ ] Modo Resgate (anti-churn)
- [ ] App mobile (React Native)

## 🐛 Troubleshooting

### Erro "Invalid API key"
- Verifique se o projeto Supabase está ativo (não pausado)
- Desabilite email confirmation: Auth → Providers → Email

### Erro de hidratação
- Limpe cache do navegador
- Reinicie o servidor: `Ctrl+C` e `npm run dev`

### Login não funciona
- Crie usuário de teste no Supabase Dashboard
- Siga o guia: `GUIA_LOGIN.md`

## 📄 Licença

MIT

## 👥 Autor

Desenvolvido com ❤️ para revolucionar a nutrição digital
