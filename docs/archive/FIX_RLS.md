# 🚨 ERRO: Row Level Security (RLS)

## O QUE ACONTECEU?

O erro que você viu:
```
Erro ao salvar: new row violates row level security policy for table "protocols"
```

Significa que o **Row Level Security (RLS)** do Supabase está bloqueando a inserção de dados.

---

## ✅ SOLUÇÃO RÁPIDA (2 minutos)

### 1. Abra o Supabase SQL Editor
```
https://antszuxeairmbctwuafo.supabase.co
Menu Lateral → SQL Editor → New Query
```

### 2. Execute Este Script
Copie e cole TODO o conteúdo do arquivo:
```
supabase/disable_rls.sql
```

OU copie isto:
```sql
ALTER TABLE protocols DISABLE ROW LEVEL SECURITY;
ALTER TABLE challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
```

### 3. Clique "Run"

### 4. Teste Novamente
- Volte em `localhost:3000/admin/protocolos`
- Crie um protocolo
- **Agora deve salvar!** ✅

---

## 🤔 POR QUE ISSO ACONTECEU?

O Supabase tem Row Level Security (RLS) que protege seus dados. Por padrão, **NINGUÉM pode inserir/ler/atualizar** a menos que você crie políticas específicas.

Como estamos em **desenvolvimento** e usando auth mockado, vamos desabilitar temporariamente.

---

## 🔐 IMPORTANTE (PARA PRODUÇÃO)

**Quando for para produção**, você vai:

1. **Reativar RLS:**
```sql
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
```

2. **Criar políticas específicas:**
```sql
-- Exemplo: Admin pode fazer tudo
CREATE POLICY "Admin full access" 
ON protocols
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM profiles WHERE role = 'admin'
  )
);

-- Exemplo: Paciente só vê seus próprios
CREATE POLICY "Patient read own" 
ON user_progress
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

Mas isso é **depois**. Agora só desabilite e teste!

---

## 📝 CHECKLIST

- [ ] Executei `disable_rls.sql` no Supabase
- [ ] Vi mensagem de sucesso
- [ ] Voltei em localhost:3000/admin
- [ ] Tentei criar protocolo novamente
- [ ] **FUNCIONOU!** ✅

---

**Execute o SQL e teste novamente!** 🚀
