# 🎯 PRÓXIMOS PASSOS - MAGIC AI GENERATOR

Você forneceu a chave OpenAI! Agora siga estes passos:

---

## 🚀 PASSO 1: Deploy da Edge Function

Abra o terminal no diretório do projeto e execute:

```bash
# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Login
supabase login

# Linkar projeto
supabase link --project-ref antszuxeairmbctwuafo

# Deploy da função
supabase functions deploy generate-protocol
```

---

## 🔑 PASSO 2: Configurar Chave no Supabase

### Via Dashboard (Recomendado):

1. **Acesse:**
   ```
   https://supabase.com/dashboard/project/antszuxeairmbctwuafo/settings/functions
   ```

2. **Vá em:** Settings → Edge Functions → "Manage secrets"

3. **Adicione:**
   ```
   Nome: OPENAI_API_KEY
   Valor: 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
   ```

4. **Salve**

---

## ✅ PASSO 3: Testar

1. **Abra:** `http://localhost:3000/admin/protocols/new`

2. **Clique:** "✨ Gerar com IA" (botão roxo no header)

3. **Digite um prompt:**
   ```
   Protocolo detox de 3 dias pós-festas, focado em desinflamação intestinal, sem glúten e sem lactose, com shots matinais
   ```

4. **Selecione:** 3 dias

5. **Clique:** "Gerar Protocolo Completo"

6. **Aguarde:** 15-30 segundos ⏱️

7. **Resultado:**
   - ✅ Título preenchido
   - ✅ Descrição criativa
   - ✅ Categoria selecionada
   - ✅ 3 dias com blocos
   - ✅ Refeições, shots, treinos
   - ✅ Horários e pontos

8. **Revise e edite** se necessário

9. **Salve!**

---

## 🎨 EXEMPLOS DE PROMPTS PARA TESTAR

### Detox (3 dias):
```
Protocolo detox pós-festas de 3 dias, focado em desinflamação intestinal, sem glúten e sem lactose, com shots matinais de cúrcuma e limão
```

### Low Carb (7 dias):
```
Protocolo de 7 dias para secar barriga, low carb, com foco em proteínas magras, jejum intermitente 16/8, treinos HIIT
```

### SOP (14 dias):
```
Protocolo de 14 dias para SOP, antiinflamatório, com foco em regulação hormonal, redução de açúcar, aumento de fibras, chás terapêuticos
```

### Ganho de Massa (21 dias):
```
Protocolo de 21 dias para ganho de massa muscular feminino, com superávit calórico moderado, 5-6 refeições/dia, pré e pós treino
```

---

## 📋 CHECKLIST

- [ ] Instalei Supabase CLI
- [ ] Fiz login (`supabase login`)
- [ ] Linkei projeto (`supabase link...`)
- [ ] Deploy da função (`supabase functions deploy...`)
- [ ] Configurei OPENAI_API_KEY no Supabase Dashboard
- [ ] Testei com prompt "Protocolo detox de 3 dias"
- [ ] **Protocolo foi gerado com sucesso!** ✅

---

## 🐛 Se Der Erro

### Erro: "OpenAI API key not configured"
→ A chave não foi salva corretamente no Supabase
→ Re-salve no Dashboard e re-deploy a função

### Erro: "Failed to generate protocol"
→ Verifique se tem créditos na OpenAI: https://platform.openai.com/usage
→ Confira se a chave está correta

### Loading infinito
→ Abra F12 → Console
→ Veja o erro
→ Tente prompt mais curto

---

## 💡 DICA IMPORTANTE

Quanto mais **específico** o prompt, melhor o resultado!

**❌ Ruim:**
```
Protocolo detox
```

**✅ Bom:**
```
Protocolo detox de 3 dias, sem glúten, com shots matinais de gengibre e limão, refeições de 1200 kcal/dia, foco em desinflamação
```

---

## 📚 DOCUMENTAÇÃO

- **Setup completo:** `OPENAI_SETUP.md`
- **Guia Magic AI:** `MAGIC_AI_GUIDE.md`
- **Protocol Builder:** `PROTOCOL_BUILDER_GUIDE.md`

---

**EXECUTE OS 3 PASSOS E COMECE A GERAR PROTOCOLOS EM SEGUNDOS!** 🚀✨
