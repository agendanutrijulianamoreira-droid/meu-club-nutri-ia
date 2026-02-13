# 🔍 Diagnóstico Completo - Erro "Invalid API Key"

## ❌ Problema Reportado
Ao criar nova conta, aparece: **"Invalid API key"**

## 🔎 Causas Possíveis

### 1. **Projeto Supabase Pausado** (Mais provável)
Os projetos gratuitos do Supabase pausam após 1 semana de inatividade.

**Como verificar:**
1. Acesse: https://supabase.com/dashboard/project/antszuxeairmbctwuafo
2. Se aparecer "Project paused" → Clique em **"Restore project"**
3. Aguarde alguns minutos até ficar "Active"

### 2. **Email Confirmation Ativado**
O Supabase exige confirmação de email, mas você não configurou SMTP.

**Como resolver:**
1. Vá em: https://supabase.com/dashboard/project/antszuxeairmbctwuafo/auth/providers
2. Clique em **"Email"**
3. Desabilite: ❌ **"Confirm email"**
4. Clique em **"Save"**

### 3. **API Key Incorreta**
As credenciais no código podem estar erradas.

**Como corrigir:**
1. Vá em: https://supabase.com/dashboard/project/antszuxeairmbctwuafo/settings/api
2. Copie a chave **"anon/public"**
3. Substitua no arquivo `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_AQUI
   ```
4. **IMPORTANTE:** Também substitua no arquivo `app/auth/actions.ts` (linha 7)

---

## ✅ Solução Rápida (Passo a Passo)

### Passo 1: Reativar Projeto (se necessário)
```
https://supabase.com/dashboard/project/antszuxeairmbctwuafo
```
- Se pausado → Clique "Restore"
- Aguarde 2-3 minutos

### Passo 2: Desabilitar Email Confirmation
```
https://supabase.com/dashboard/project/antszuxeairmbctwuafo/auth/providers
```
- Email → ❌ Desmarque "Confirm email" → Save

### Passo 3: Verificar API Key
```
https://supabase.com/dashboard/project/antszuxeairmbctwuafo/settings/api
```
- Copie "anon/public" key
- Cole no `.env.local` e `app/auth/actions.ts`

### Passo 4: Reiniciar Servidor
```bash
# No terminal (Ctrl+C para parar)
npm run dev
```

### Passo 5: Testar
```
http://localhost:3000/login
```
- Criar conta → Deve funcionar! ✅

---

## 🧪 Teste Alternativo: Criar Usuário Manual

Se ainda não funcionar, crie manualmente para testar o dashboard:

1. **Supabase → Authentication → Users → Add User**
   - Email: `teste@teste.com`
   - Password: `123456`
   - ✅ Auto Confirm User

2. **Table Editor → profiles → Insert**
   ```sql
   user_id: [UUID do usuário]
   tenant_id: 00000000-0000-0000-0000-000000000001
   name: Teste
   email: teste@teste.com
   current_plan: community
   nutri_coins: 100
   total_xp: 0
   current_level: 1
   ```

3. **Login com:**
   - Email: `teste@teste.com`
   - Senha: `123456`

---

## 📝 Checklist

- [ ] Projeto está "Active" (não pausado)
- [ ] Email confirmation desabilitado
- [ ] API key copiada e colada corretamente
- [ ] Servidor reiniciado após mudanças
- [ ] Testado criar conta novamente

Se marcar todos ✅ e ainda der erro, me mande um print do console do navegador (F12)!
