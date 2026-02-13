# 🚀 DEPLOY RÁPIDO - GPT-4o-mini

## 📋 PASSO A PASSO (5 MINUTOS)

### PASSO 1: Instalar Supabase CLI

Abra o **PowerShell como Administrador** e execute:

```powershell
npm install -g supabase
```

Aguarde completar (1-2 minutos).

---

### PASSO 2: Login no Supabase

```powershell
supabase login
```

**O que vai acontecer:**
- Abrirá o navegador
- Clique "Authorize"
- Volte ao terminal
- ✅ "Logged in."

---

### PASSO 3: Linkar o Projeto

```powershell
supabase link --project-ref antszuxeairmbctwuafo
```

**Como responder:**
- `Enter your database password:` → Digite a senha do seu Supabase
- ✅ "Finished supabase link."

**Não sabe a senha?**
1. Vá em: https://supabase.com/dashboard/project/antszuxeairmbctwuafo/settings/database
2. Clique "Reset Database Password"
3. Defina nova senha
4. Use ela aqui

---

### PASSO 4: Deploy da Edge Function

```powershell
cd c:/Users/Nutri/.gemini/antigravity/playground/ionized-kepler
supabase functions deploy generate-protocol
```

**O que vai acontecer:**
- "Uploading generate-protocol..."
- "Deploying function..."
- ✅ "Deployed Function generate-protocol"

---

### PASSO 5: Configurar OpenAI API Key

#### OPÇÃO A: Via Dashboard (Mais Fácil)

1. **Acesse:**
   ```
   https://supabase.com/dashboard/project/antszuxeairmbctwuafo/settings/functions
   ```

2. **No menu lateral:**
   - Settings (⚙️)
   - Edge Functions
   - Clique "Add secret" ou "Manage secrets"

3. **Preencha:**
   ```
   Name: OPENAI_API_KEY
   Value: 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
   ```

4. **Clique "Save"**

#### OPÇÃO B: Via CLI (Avançado)

```powershell
supabase secrets set OPENAI_API_KEY=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
```

---

## ✅ TESTAR

### 1. Verificar Deploy

```
https://supabase.com/dashboard/project/antszuxeairmbctwuafo/functions
```

Você deve ver:
- ✅ **generate-protocol** (status: active)

### 2. Testar na Aplicação

1. **Abra:** `http://localhost:3000/admin/protocols/new`
2. **Clique:** "✨ Gerar com IA"
3. **Digite:**
   ```
   Protocolo detox de 3 dias pós-festas, focado em desinflamação intestinal
   ```
4. **Duração:** 3 dias
5. **Clique:** "Gerar Protocolo Completo"
6. **Aguarde:** 10-20 segundos (OpenAI real é um pouco mais lento que o mock)
7. ✅ **Protocolo personalizado será gerado!**

---

## 💰 CUSTOS GPT-4o-mini

### Pricing (Muito Barato!):
- **Input:** $0.15 / 1M tokens (~$0.000015 por 100 tokens)
- **Output:** $0.60 / 1M tokens (~$0.000060 por 100 tokens)

### Por Protocolo:
- **Input:** ~1500 tokens = $0.000225
- **Output:** ~3000 tokens = $0.0018
- **Total:** ~**$0.002 por protocolo** 🎉

### Comparação:
- **GPT-4o:** ~$0.03/protocolo
- **GPT-4o-mini:** ~$0.002/protocolo
- **Economia:** 15x mais barato! 💸

### Na Prática:
- **100 protocolos = $0.20**
- **1000 protocolos = $2.00**
- **Praticamente de graça!** ✨

---

## 🔍 MONITORAR USO

```
https://platform.openai.com/usage
```

Você verá:
- Requests enviados
- Tokens usados
- Custo total

---

## 🐛 TROUBLESHOOTING

### Erro: "command not found: supabase"
**Solução:**
```powershell
# Feche e reabra PowerShell como Admin
npm install -g supabase
```

### Erro ao fazer link
**Solução:**
```powershell
# Fazer logout e login novamente
supabase logout
supabase login
supabase link --project-ref antszuxeairmbctwuafo
```

### Edge Function não aparece no dashboard
**Solução:**
```powershell
# Re-deploy
supabase functions deploy generate-protocol --no-verify-jwt
```

### Erro: "Invalid API key"
**Causa:** Chave OpenAI incorreta ou sem créditos

**Solução:**
1. Verifique em: https://platform.openai.com/api-keys
2. Verifique créditos em: https://platform.openai.com/usage
3. Se necessário, adicione $5-10 de crédito

### Protocolo não gera (loading infinito)
**Console do navegador (F12):**
- Veja mensagens de erro
- Se mostrar erro 500: problema na Edge Function
- Se mostrar erro de CORS: problema de configuração

**Solução:**
```powershell
# Ver logs da função
supabase functions logs generate-protocol --follow
```

---

## 📊 DIFERENÇA: Mock vs Real

### Mock (Atual):
- ✅ Instant âneo (2s)
- ✅ Offline
- ✅ Grátis
- ❌ Estrutura fixa
- ❌ Pouca variação

### GPT-4o-mini (Após Deploy):
- ✅ Protocolos únicos
- ✅ Entende contexto complexo
- ✅ Receitas específicas
- ✅ Tom personalizado
- ✅ Super barato ($0.002)
- ⏱️ 10-20 segundos
- 📡 Requer internet

---

## ✅ CHECKLIST

- [ ] Instalei Supabase CLI
- [ ] Fiz `supabase login`
- [ ] Fiz `supabase link --project-ref antszuxeairmbctwuafo`
- [ ] Fiz `supabase functions deploy generate-protocol`
- [ ] Configurei OPENAI_API_KEY no dashboard
- [ ] Testei na aplicação
- [ ] **Protocolo foi gerado com GPT-4o-mini!** ✅

---

## 🎉 PRONTO!

Agora você tem:
- ✅ Geração de protocolos 100% personalizada
- ✅ Custo praticamente zero ($0.002/protocolo)
- ✅ Fallback automático para mock se offline
- ✅ Sistema profissional de IA

**EXECUTE OS COMANDOS E TESTE!** 🚀
