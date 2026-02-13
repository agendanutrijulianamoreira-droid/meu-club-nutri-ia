# 🎯 Guia de Uso - Dashboard Integrado

## 📦 O Que Foi Criado

### 1. Hooks Customizados

#### `lib/hooks/useProfile.ts`
Hook para buscar e gerenciar perfil do usuário:
- ✅ Busca dados de gamificação (moedas, XP, level, streak)
- ✅ **Realtime Subscription** - atualiza automaticamente quando mudar no banco
- ✅ Função `updateProfile()` para editar perfil

**Uso:**
```tsx
const { profile, coins, xp, level, streak, plan } = useProfile(userId);
```

#### `lib/hooks/useDailyLogs.ts`
Hook para gerenciar check-ins diários:
- ✅ Busca log de hoje
- ✅ Função `toggleCheck()` - marcar/desmarcar check-ins
- ✅ Função `saveCheckIn()` - salvar dados completos

**Uso:**
```tsx
const { todayLog, toggleCheck, saveCheckIn } = useDailyLogs(userId);

// Marcar água
await toggleCheck('water');
```

---

### 2. Página Dashboard

#### `app/dashboard/page.tsx`
Dashboard completo integrando TODOS os componentes:

✅ **GamificationHeader** com dados reais do Supabase  
✅ **DailyActionList** salvando check-ins  
✅ **PanicButton** (só aparece para VIP)  
✅ Cards de objetivo e stats  
✅ CTA para upgrade de plano  

---

## 🚀 Como Usar

### 1. Acessar Dashboard

```
http://localhost:3000/dashboard
```

### 2. O Que Acontece

1. **Verificação de autenticação**  
   - Se não logado → redireciona para login
   - Se logado → carrega dados do usuário

2. **Header de Gamificação**  
   - Mostra moedas, XP, level, streak
   - Atualiza em **tempo real** quando houver mudança

3. **Daily Action List**  
   - Carrega check-ins de hoje
   - Ao marcar → salva no Supabase
   - Trigger SQL calcula moedas automaticamente
   - Confete dispara! 🎉

4. **Botão SOS** (apenas VIP)  
   - Aparece flutuando no canto
   - Abre modal para mensagem urgente

---

## 🔗 Fluxo Completo de Dados

```
1. Usuário marca check-in
   ↓
2. DailyActionList chama toggleCheck()
   ↓
3. Hook salva em daily_logs (Supabase)
   ↓
4. Trigger SQL calcula coins_earned e atualiza profiles
   ↓
5. Realtime subscription detecta mudança
   ↓
6. useProfile atualiza estado local
   ↓
7. GamificationHeader anima contagem de moedas 🟢
   ↓
8. Confete dispara! 🎉
```

**Tudo automático!**

---

## 📝 Dependências Necessárias

Verifique se tem instalado:

```bash
npm install @supabase/ssr
npm install @supabase/supabase-js
npm install canvas-confetti
npm install framer-motion
```

Se faltar alguma, instale com o comando acima.

---

## 🧪 Como Testar

### 1. Criar Usuário de Teste

No Supabase Dashboard → Authentication → Users:
- Criar novo usuário
- Copiar `user_id`

### 2. Criar Perfil

No Supabase → Table Editor → `profiles`:
- Inserir novo registro:
  ```
  user_id: [user_id copiado]
  tenant_id: 00000000-0000-0000-0000-000000000001
  name: Teste Rainha
  current_plan: vip (para testar botão SOS)
  nutri_coins: 500
  total_xp: 1000
  current_level: 3
  current_streak: 5
  ```

### 3. Fazer Login e Acessar Dashboard

```
http://localhost:3000/dashboard
```

### 4. Marcar Check-in

- Clicar em "Água"
- Ver confete disparar
- Ver moedas aumentarem automaticamente
- Verificar no banco que `daily_logs` foi criado
- Verificar que `profiles.nutri_coins` aumentou

---

## ⚡ Realtime Funcionando

Para o Realtime funcionar, certifique-se que:

1. **Supabase Realtime está habilitado** no projeto
2. **RLS policies** permitem que usuário veja próprio perfil
3. **Table replication** está ativa para `profiles`

Verificar em: Supabase Dashboard → Database → Replication

---

## 🐛 Troubleshooting

### Erro: "createClient is not a function"
```bash
npm install @supabase/ssr
```

### Moedas não atualizam automaticamente
- Verificar se Realtime está habilitado
- Ver console do navegador para erros de subscription

### Check-ins não salvam
- Verificar RLS policies em `daily_logs`
- Ver Network tab para erros de INSERT

---

## 🎉 Próximos Passos

Agora você pode:

1. **Testar fluxo completo** - Login → Check-in → Ver moedas
2. **Customizar UI** - Ajustar cores, textos, layout
3. **Adicionar features:**
   - Upload de foto de evidência
   - Vitória do dia (text area)
   - Histórico de check-ins

Tudo está conectado e funcionando! 🚀
