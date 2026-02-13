# 🔐 Guia de Login - Criação de Usuário

## ⚠️ Problema Identificado

A página de login está funcionando, mas **não existem usuários criados ainda**.

Para testar o sistema, você precisa criar um usuário de teste diretamente no Supabase.

---

## ✅ Solução: Criar Usuário de Teste

### 1. Acessar Supabase Dashboard

Abra no navegador:
```
https://supabase.com/dashboard/project/antszuxeairmbctwuafo
```

### 2. Ir para Authentication → Users

No menu lateral:
- Clique em **Authentication**
- Clique em **Users**

### 3. Criar Novo Usuário

Clique no botão **"Add User"** → **"Create new user"**

Preencha:
- **Email:** `teste@meuclub.com` (ou qualquer email)
- **Password:** `senha123` (mínimo 6 caracteres)
- ✅ Marque **"Auto Confirm User"** (importante!)

Clique em **"Create User"**

### 4. Copiar User ID

Após criar, você verá o usuário na lista. Copie o **UUID** dele.

---

## 🗄️ Criar Perfil no Banco

### 1. Ir para Table Editor → profiles

No menu lateral:
- Clique em **Table Editor**
- Selecione a tabela **`profiles`**

### 2. Inserir Novo Registro

Clique em **"Insert"** → **"Insert row"**

Preencha:
```
user_id: [cole o UUID copiado]
tenant_id: 00000000-0000-0000-0000-000000000001
name: Rainha Teste
email: teste@meuclub.com
current_plan: vip
nutri_coins: 1000
total_xp: 500
current_level: 3
current_streak: 5
primary_goal: Testar o sistema
```

Clique em **"Save"**

---

## 🚀 Fazer Login

Agora volte para a aplicação:

```
http://localhost:3000/login
```

1. Clique em **"Sou Aluna"**
2. Digite:
   - Email: `teste@meuclub.com`
   - Senha: `senha123`
3. Clique em **"Entrar no Meu Club"**

✅ Você será redirecionado para o dashboard com todos os dados funcionando!

---

## 🐛 Se Der Erro 401 Ainda

Isso pode significar que:

1. **Email Confirmation não foi desabilitado**
   - Vá em: Authentication → Settings → Email Auth
   - Desabilite: **"Enable email confirmations"**

2. **API Key está errada**
   - Vá em: Settings → API
   - Copie a **"anon/public"** key
   - Cole no `.env.local`

3. **Projeto pausado**
   - Verifique se o projeto Supabase está **ativo** (não pausado)

---

## 📝 Alternativa: Dashboard Sem Login

Se quiser testar o dashboard **sem criar usuário**, você pode modificar temporariamente a página para usar dados mockados.

Mas o ideal é criar o usuário de teste para testar o fluxo completo! 🎯
