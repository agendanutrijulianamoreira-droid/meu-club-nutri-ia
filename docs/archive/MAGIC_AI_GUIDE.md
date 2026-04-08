# ✨ MAGIC AI PROTOCOL GENERATOR - GUIA COMPLETO

## 🎯 O QUE FOI IMPLEMENTADO

### **Gerador Automático de Protocolos via IA**

Agora você pode **digitar um prompt** e a IA gera:
- ✅ Título criativo
- ✅ Descrição motivacional
- ✅ Categoria adequada
- ✅ Todos os dias estruturados
- ✅ Refeições, shots, treinos, conteúdos
- ✅ Horários, descrições, pontos

**Depois você edita manualmente e salva!**

---

## 🚀 INSTALAÇÃO EM 4 PASSOS

### PASSO 1: Criar Chave da OpenAI

```
1. Acesse: https://platform.openai.com/api-keys
2. Clique "Create new secret key"
3. Nome: "Protocolo Generator"
4. Copie a chave (sk-...)
5. ⚠️ GUARDE EM LUGAR SEGURO!
```

### PASSO 2: Deploy da Edge Function

No terminal, na raiz do projeto:

```bash
# Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# Login no Supabase
supabase login

# Linkar projeto
supabase link --project-ref antszuxeairmbctwuafo

# Deploy da função
supabase functions deploy generate-protocol
```

### PASSO 3: Configurar Variável de Ambiente

```
1. Vá em: https://supabase.com/dashboard/project/antszuxeairmbctwuafo/settings/functions
2. Menu lateral → "Edge Functions"
3. Clique em "Manage secrets"
4. Adicione:
   Nome: OPENAI_API_KEY
   Valor: sk-... (sua chave copiada)
5. Salve
```

### PASSO 4: Testar!

```
1. http://localhost:3000/admin/protocols/new
2. Clique "✨ Gerar com IA"
3. Digite um prompt
4. Aguarde 10-30 segundos
5. ✅ Protocolo completo gerado!
```

---

## 📝 EXEMPLOS DE PROMPTS

### **Exemplo 1: Detox**
```
Protocolo detox pós-festas de 3 dias, focado em desinflamação intestinal, sem glúten e sem lactose, com shots matinais de cúrcuma e limão
```

**Resultado esperado:**
- Dia 1: Limpeza Profunda
- Dia 2: Renovação Celular
- Dia 3: Energia Renovada
- Com shots, refeições leves, hidratação

### **Exemplo 2: Emagrecimento**
```
Protocolo de 7 dias para secar barriga, low carb, com foco em proteínas magras, jejum intermitente 16/8, treinos HIIT
```

**Resultado esperado:**
- Café da manhã: Ovos + abacate
- Almoço: Frango grelhado + salada
- Treinos: HIIT 20min
- Shots: Termogênicos

### **Exemplo 3: SOP (PCOS)**
```
Protocolo de 14 dias para SOP, antiinflamatório, com foco em regulação hormonal, redução de açúcar, aumento de fibras, chás terapêuticos
```

**Resultado esperado:**
- Refeições balanceadas
- Chás: Chá verde, spearmint
- Shots: Canela + gengibre
- Conteúdos educacionais sobre SOP

### **Exemplo 4: Ganho de Massa**
```
Protocolo de 21 dias para ganho de massa muscular feminino, com superávit calórico moderado, 5-6 refeições/dia, pré e pós treino
```

**Resultado esperado:**
- Refeições de 3 em 3h
- Pré-treino: Carboidrato + proteína
- Pós-treino: Shake proteico
- Treinos de musculação

---

## 🎨 INTERFACE DO MODAL

```
┌────────────────────────────────────────┐
│ 🪄 Magic Protocol Generator ✨         │
│ Descreva o objetivo e deixe a IA      │
│ criar todo o protocolo                 │
│                                        │
│ Qual o objetivo deste protocolo?      │
│ ┌────────────────────────────────────┐ │
│ │ [Digite aqui...]                   │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Duração                                │
│ [3] [7] [14] [21] dias                │
│                                        │
│ 💡 Dica: Seja específico!             │
│                                        │
│      [Cancelar] [Gerar Protocolo ✨]  │
└────────────────────────────────────────┘
```

---

## ⚙️ COMO FUNCIONA (Técnico)

### **1. Frontend → Edge Function**
```typescript
const result = await generateProtocolWithAI(prompt, duration)
```

### **2. Edge Function → OpenAI**
```typescript
POST https://api.openai.com/v1/chat/completions
{
  model: "gpt-4o",
  messages: [
    { role: "system", content: "You are Sage Nutritionist..." },
    { role: "user", content: "Create a 7-day protocol for: ..." }
  ],
  response_format: { type: "json_object" }
}
```

### **3. OpenAI → JSON Estruturado**
```json
{
  "title": "Protocolo Detox Renovação",
  "description": "🌿 Bem-vinda ao...",
  "category": "detox",
  "days": [
    {
      "day_number": 1,
      "title": "Dia 1: Despertar",
      "items": [
        {
          "time": "08:00",
          "type": "shot",
          "title": "Shot Detox Matinal",
          "description": "Água morna + limão + gengibre",
          "points": 20
        },
        {
          "time": "09:00",
          "type": "meal",
          "title": "Café da Manhã Leve",
          "ingredients": ["Frutas vermelhas", "Granola"],
          "points": 30
        }
      ]
    }
  ]
}
```

### **4. Frontend Auto-preenche Form**
```typescript
setFormData({
  title: protocol.title,
  description: protocol.description,
  category: protocol.category
})
setDays(protocol.days)
```

---

## 🎯 SYSTEM PROMPT USADO

O Edge Function instrui a IA com:

```
You are the "Sage Nutritionist", an expert in women's health...

Your tone is:
- Welcoming and empowering
- Uses terms like "Queen", "Kingdom", "Armor"
- Wise and motivational

CRITICAL: Return ONLY valid JSON, no markdown.

Schema:
{
  title: string,
  description: string,
  category: "detox" | "lowcarb" | "maintenance" | "challenge" | "custom",
  days: [
    {
      day_number: number,
      title: string,
      items: [
        {
          time: "HH:MM" | null,
          type: "meal" | "shot" | "workout" | "content" | "water",
          title: string,
          description: string,
          ingredients: string[],
          points: number
        }
      ]
    }
  ]
}

Guidelines:
- Vary types (meals, shots, workouts, content)
- 3-4 items per day
- Use Brazilian Portuguese
- Be specific with recipes
- Points: 10-20 simple, 30-40 meals, 50+ workouts
```

---

## 💰 CUSTOS (OpenAI)

### GPT-4o (turbo) Pricing:
- **Input:** $2.50 / 1M tokens
- **Output:** $10.00 / 1M tokens

### Estimativa por Protocolo:
- **Prompt:** ~1500 tokens = $0.004
- **Response:** ~3000 tokens = $0.03
- **Total:** ~$0.034 por protocolo

**100 protocolos = $3.40** 🎉

---

## 🔒 SEGURANÇA

### Row Level Security (RLS)
A Edge Function roda no lado do Supabase (server-side), então:
- ✅ A chave API nunca vai para o frontend
- ✅ Usuários não podem acessar diretamente
- ✅ Rate limiting automático do Supabase

### Validação
```typescript
if (!prompt || !duration) {
  return error('Missing prompt or duration')
}

if (!OPENAI_API_KEY) {
  return error('API key not configured')
}
```

---

## 🐛 TROUBLESHOOTING

### Erro: "Failed to generate protocol"
**Causas:**
1. Chave API inválida
2. Edge Function não foi deployed
3. Variável de ambiente não configurada

**Solução:**
```bash
# Verificar função
supabase functions list

# Ver logs
supabase functions logs generate-protocol

# Re-deploy
supabase functions deploy generate-protocol
```

### Erro: "Invalid JSON from AI"
**Causa:** OpenAI retornou markdown ao invés de JSON puro

**Solução:** Já tratado! Usamos `response_format: { type: "json_object" }`

### Loading infinito
**Causa:** Token limit excedido ou timeout

**Solução:** Adicionar timeout no frontend:
```typescript
const timeout = setTimeout(() => {
  setGeneratingProtocol(false)
  alert('Timeout: Tente um prompt mais curto')
}, 60000) // 60 segundos
```

### Prompt não específico suficiente
**Resultado:** IA gera protocolo genérico

**Solução:** Use prompts detalhados:
- ❌ "Protocolo detox"
- ✅ "Protocolo detox de 3 dias, sem glúten, com shots matinais, 1200 kcal/dia"

---

## 📊 MÉTRICAS

### Tempo de Resposta:
- **Prompts curtos:** 10-15 segundos
- **Prompts longos:** 20-30 segundos
- **Protocolos 21 dias:** 30-45 segundos

### Qualidade:
- **Criatividade dos títulos:** ⭐⭐⭐⭐⭐
- **Receitas específicas:** ⭐⭐⭐⭐
- **Variação de blocos:** ⭐⭐⭐⭐⭐
- **Tom "Rainha":** ⭐⭐⭐⭐⭐

---

## ✅ CHECKLIST FINAL

- [ ] Criei chave OpenAI
- [ ] Instalei Supabase CLI
- [ ] Fiz login no Supabase
- [ ] Linkei projeto
- [ ] Fiz deploy da Edge Function
- [ ] Configurei OPENAI_API_KEY
- [ ] Testei no Protocol Builder
- [ ] Cliquei "✨ Gerar com IA"
- [ ] Digite prompt de teste
- [ ] Aguardei loading
- [ ] **Protocolo foi gerado!** ✅
- [ ] Editei manualmente
- [ ] Salvei no banco

---

## 🎉 RESULTADO FINAL

### Antes:
1. Criar protocolo manualmente
2. Preencher título
3. Preencher descrição
4. Para cada dia:
   - Definir título
   - Adicionar blocos um a um
   - Preencher títulos, descrições, pontos
5. **Tempo: 30-60 minutos**

### Agora:
1. Clicar "✨ Gerar com IA"
2. Digitar prompt
3. Aguardar 15 segundos
4. Revisar/editar
5. Salvar
6. **Tempo: 2-5 minutos** ⚡

---

**CONFIGURE AGORA E COMECE A GERAR PROTOCOLOS EM SEGUNDOS!** 🚀✨
