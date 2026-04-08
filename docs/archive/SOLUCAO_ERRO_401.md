# 🔧 Solução para Erro 401 - Unauthorized

## Problema

Você está recebendo erro **401 (Unauthorized)** ao tentar criar conta ou fazer login.

## ✅ Solução: Desativar Email Confirmation

O Supabase está exigindo confirmação de email, mas você não configurou envio de emails ainda.

### Passo a Passo:

1. **Abra o Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/antszuxeairmbctwuafo
   ```

2. **Vá para Authentication → Providers → Email:**
   - No menu lateral: **Authentication**
   - Clique em **Providers**
   - Clique em **Email**

3. **Desabilite "Confirm email":**
   - Procure a opção: **"Confirm email"**
   - ❌ **Desative** essa opção
   - Clique em **"Save"**

4. **Teste novamente:**
   - Volte para: `http://localhost:3000/login`
   - Clique em "Criar Conta"
   - Preencha os dados
   - Deve funcionar! ✅

---

## Alternativa: Teste Rápido com Usuário Manual

Se quiser testar AGORA sem esperar, crie um usuário manualmente:

### No Supabase Dashboard:

1. **Authentication → Users → Add User**

2. Preencha:
   - Email: `teste@teste.com`
   - Password: `123456`
   - ✅ Marque: **"Auto Confirm User"**

3. **Table Editor → profiles → Insert Row**
   ```
   user_id: [cole o UUID do usuário criado acima]
   tenant_id: 00000000-0000-0000-0000-000000000001
   name: Teste
   email: teste@teste.com
   current_plan: community
   nutri_coins: 100
   total_xp: 0
   current_level: 1
   current_streak: 0
   longest_streak: 0
   ```

4. Faça login com:
   - Email: `teste@teste.com`
   - Senha: `123456`

---

## Verificar se funcionou

Se ainda der erro, verifique:

1. **Projeto está ativo?**
   - Dashboard → Overview
   - Status deve ser: **"Active"** (não "Paused")

2. **API Keys estão corretas?**
   - Settings → API
   - Copie: **"anon/public"**
   - Cole no `.env.local`

3. **Reinicie o servidor:**
   ```bash
   # No terminal, pressione Ctrl+C
   # Depois rode novamente:
   npm run dev
   ```

---

## 🎯 Resumo Rápido

**Problema:** Email confirmation bloqueando signup  
**Solução:** Desativar em Authentication → Providers → Email → ❌ Confirm email

Depois disso, deve funcionar perfeitamente! 🚀
