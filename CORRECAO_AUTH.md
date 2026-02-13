# 🔐 Guia de Correção - Autenticação Completa

## ✅ Correções Implementadas

### 1. **Middleware Criado** (`middleware.ts`)
Mantém a sessão do usuário ativa entre páginas. Sem ele, o login "cai" ao navegar.

### 2. **Trigger do Banco** (`supabase/trigger_auto_create_profile.sql`)
Cria perfil automaticamente na tabela `profiles` quando usuário se cadastra.

### 3. **Rota de Callback** (`app/auth/callback/route.ts`)
Finaliza processo de autenticação e redireciona para dashboard.

---

## 📋 Passos para Ativar

### PASSO 1: Instalar Dependência

```bash
npm install @supabase/auth-helpers-nextjs
```

### PASSO 2: Executar SQL no Supabase

1. **Abra:** https://supabase.com/dashboard/project/antszuxeairmbctwuafo/editor

2. **Vá em:** SQL Editor (menu lateral)

3. **Copie e cole** o conteúdo de: `supabase/trigger_auto_create_profile.sql`

4. **Execute** (Run)

5. **Verifique:** Se aparecer 1 linha na tabela de resultados, está ativo! ✅

### PASSO 3: Reiniciar Servidor

```bash
# Ctrl+C no terminal que está rodando npm run dev
# Depois:
npm run dev
```

---

## 🧪 Como Testar

1. **Vá para:** `http://localhost:3000/login`

2. **Clique em:** "Criar Conta"

3. **Preencha:**
   - Nome: Seu nome
   - Email: teste@exemplo.com
   - Senha: 123456

4. **Crie a conta**

5. **O que deve acontecer:**
   - ✅ Usuário criado no `auth.users`
   - ✅ Perfil criado automaticamente em `profiles` (pelo trigger)
   - ✅ 100 NutriCoins creditados 🎉
   - ✅ Redirecionado para `/dashboard`
   - ✅ Dashboard mostra seus dados (nome, moedas, level)

---

## 🔍 Verificar se Funcionou

### No Supabase Dashboard:

1. **Authentication → Users**
   - Deve aparecer o usuário criado

2. **Table Editor → profiles**
   - Deve ter uma linha com o mesmo `user_id`
   - `nutri_coins` = 100
   - `current_level` = 1

Se os dois existirem, **FUNCIONOU!** 🎊

---

## ⚠️ Configurações Importantes

### Desabilitar Email Confirmation

Para testar sem esperar email:

1. **Vá em:** https://supabase.com/dashboard/project/antszuxeairmbctwuafo/auth/providers

2. **Email → Settings**

3. **Desmarque:** "Confirm email"

4. **Salve**

### Configurar URL de Redirect

1. **Vá em:** Auth → URL Configuration

2. **Adicione em "Redirect URLs":**
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/dashboard
   ```

3. **Salve**

---

## 🐛 Troubleshooting

### "Session não persiste"
- ✅ Middleware instalado? Reinicie o servidor

### "Usuário criado mas não aparece no dashboard"
- ✅ Trigger executado no Supabase?
- ✅ Verifique `Table Editor → profiles`

### "Redirect loop"
- ✅ Verifique se URL de callback está correta nas settings do Supabase

### "Erro 400"
- ✅ Email confirmation desabilitado?
- ✅ Projeto Supabase está ativo (não pausado)?

---

## 📊 Arquitetura

```
USER
  ↓
[LOGIN PAGE] → signupUser (Server Action)
  ↓
[SUPABASE AUTH] → cria em auth.users
  ↓
[TRIGGER] → cria automaticamente em profiles
  ↓
[CALLBACK ROUTE] → valida sessão
  ↓
[MIDDLEWARE] → mantém sessão ativa
  ↓
[DASHBOARD] → lê dados de profiles
```

---

**Agora sim está COMPLETO!** 🚀

Execute o trigger SQL, instale a dependência, e teste criar uma conta!
