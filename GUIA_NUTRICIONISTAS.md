# 🚀 GUIA DE EXECUÇÃO - Sistema de Nutricionistas

## 📝 Resumo

Este guia mostra como configurar o banco de dados e testar a nova funcionalidade de cadastro de nutricionistas no painel admin.

---

## 🗄️ PASSO 1: Executar SQL no Supabase

### 1.1 Acessar Supabase Dashboard

```
1. Abrir: https://supabase.com/dashboard/project/antszuxeairmbctwuafo
2. Fazer login se necessário
3. Ir em "SQL Editor" no menu lateral
```

### 1.2 Executar Schema de Nutricionistas

```
1. Clicar em "New Query"
2. Copiar TODO o conteúdo de: supabase/schema_nutritionists.sql
3. Colar no editor
4. Clicar em "RUN" (ou Ctrl+Enter)
5. Verificar mensagem de sucesso: "Success. No rows returned"
```

### 1.3 Executar Schema de Comissões

```
1. Clicar em "New Query" novamente
2. Copiar TODO o conteúdo de: supabase/schema_commissions.sql
3. Colar no editor
4. Clicar em "RUN"
5. Verificar sucesso
```

### 1.4 Executar Schema de Agendamentos

```
1. Clicar em "New Query" novamente
2. Copiar TODO o conteúdo de: supabase/schema_appointments.sql
3. Colar no editor
4. Clicar em "RUN"
5. Verificar sucesso
```

### 1.5 Verificar Tabelas Criadas

```
1. Ir em "Table Editor" no menu lateral
2. Verificar se as seguintes tabelas existem:
   ✅ nutritionists
   ✅ referrals
   ✅ commissions
   ✅ appointments
```

---

## 💻 PASSO 2: Testar Interface Admin

### 2.1 Iniciar Servidor (se não estiver rodando)

```bash
cd "c:\Users\Nutri\Downloads\MEU CONSULTÓRIO\MEUS 30K\ia\MEU CLUB NUTRI IA"
npm run dev
```

### 2.2 Acessar Painel Admin

```
1. Abrir navegador: http://localhost:3000/admin
2. Fazer login se necessário
3. No menu lateral, clicar em "Nutricionistas" (ícone de escudo)
```

### 2.3 Verificar Interface

Você deve ver:

✅ **Cards de Estatísticas** (5 cards no topo):
- Total de nutricionistas
- Nutricionistas ativos
- Com comissão habilitada
- Com agenda habilitada
- Moderadores

✅ **Barra de Busca e Filtros**:
- Campo de busca por nome/email
- Botões: Todos | Ativos | Inativos

✅ **Lista de Nutricionistas** (3 exemplos com dados mock):
- Avatar, nome, email, CRN
- Especialidades em tags
- Estatísticas mini (comissões, consultas, conversões)
- Código de indicação (se habilitado)
- Botões de editar e remover

---

## 🧪 PASSO 3: Testar Dados Reais (Opcional)

### 3.1 Inserir Nutricionista de Teste via SQL

```sql
-- Voltar ao SQL Editor no Supabase
-- Copiar e executar:

INSERT INTO nutritionists (
  name,
  email,
  crn,
  specialties,
  commission_enabled,
  commission_rate,
  is_moderator,
  calendar_enabled,
  tenant_id
) VALUES (
  'Dr. João Silva',
  'joao.silva@example.com',
  'CRN-3 99999',
  ARRAY['Clínica', 'Esportiva'],
  true,
  12.50,
  true,
  true,
  '00000000-0000-0000-0000-000000000001' -- ID do tenant demo
);
```

### 3.2 Verificar na Interface

```
1. Recarregar página do admin
2. O novo nutricionista deve aparecer na lista
3. Verificar código de indicação foi gerado automaticamente
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Banco de Dados
- [ ] Tabela `nutritionists` criada
- [ ] Tabela `referrals` criada
- [ ] Tabela `commissions` criada
- [ ] Tabela `appointments` criada
- [ ] Triggers funcionando (referral_code gerado automaticamente)
- [ ] RLS policies ativas

### Interface Admin
- [ ] Menu "Nutricionistas" aparece no sidebar
- [ ] Página carrega sem erros
- [ ] Cards de estatísticas exibidos
- [ ] Busca funciona
- [ ] Filtros funcionam (Todos/Ativos/Inativos)
- [ ] Lista de nutricionistas renderiza
- [ ] Badge de "Moderador" aparece corretamente
- [ ] Botão "Copiar código" funciona

### Console do Navegador
- [ ] Sem erros no console (F12 → Console)
- [ ] Sem warnings críticos

---

## 🚨 TROUBLESHOOTING

### Erro: "relation 'nutritionists' does not exist"
**Solução**: Executar novamente o `schema_nutritionists.sql` no SQL Editor

### Erro: "function update_updated_at() does not exist"
**Solução**: Esta função já deveria existir do `schema_core.sql`. Se não existir, executar `schema_core.sql` primeiro.

### Erro na Interface: "Cannot find module './views/NutritionistsView'"
**Solução**: Verificar se o arquivo foi criado corretamente em `app/admin/views/NutritionistsView.tsx`

### Nutricionistas não aparecem na lista
**Solução**: Por enquanto a interface usa dados mock. Para conectar com Supabase real:
1. Criar hook `useSupabase` 
2. Fazer query em `nutritionists`
3. Substituir array mock pelo resultado da query

---

## 📱 PRÓXIMOS PASSOS

1. **Conectar com Supabase Real**:
   - Criar hooks para CRUD de nutricionistas
   - Substituir dados mock

2. **Modal de Cadastro/Edição**:
   - Formulário completo com todos os campos
   - Abas: Dados Pessoais | Comissão | Moderação | Agenda

3. **Sistema de Comissões**:
   - Painel detalhado de comissões por nutricionista
   - Gráficos de performance

4. **Agenda de Consultas**:
   - Calendário visual
   - Sistema de notificações

---

## 🎉 RESUMO DO QUE FOI CRIADO

### Arquivos de Banco de Dados (3)
- ✅ `supabase/schema_nutritionists.sql` - Tabela principal + RLS
- ✅ `supabase/schema_commissions.sql` - Sistema de indicações e comissões
- ✅ `supabase/schema_appointments.sql` - Agendamento de consultas

### Componentes React (1)
- ✅ `app/admin/views/NutritionistsView.tsx` - Interface completa de gerenciamento

### Modificações (1)
- ✅ `app/admin/page.tsx` - Integração com menu admin

**Total de Linhas**: ~1.200 linhas de código
**Tempo estimado de setup**: 15-20 minutos

---

**Dúvidas?** Consulte o `implementation_plan.md` para detalhes técnicos! 🚀
