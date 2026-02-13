# 🚀 Deploy da Edge Function - Guia Passo a Passo

## Comandos para Executar no PowerShell

Abra o PowerShell na pasta do projeto e execute estes comandos **na ordem**:

### 1. Login no Supabase
```powershell
npx supabase login
```
- Vai abrir o navegador para autenticação
- Faça login com sua conta Supabase
- Aguarde mensagem de sucesso

### 2. Link do Projeto
```powershell
npx supabase link --project-ref antszuxeairmbctwuafo
```
- Conecta o CLI com seu projeto
- Pressione Enter quando pedir senha (deixe em branco)

### 3. Deploy da Função
```powershell
npx supabase functions deploy generate-menu
```
- Aguarde upload e deploy (1-2 minutos)
- Deve retornar URL da função

### 4. Verificar Deploy
```powershell
npx supabase functions list
```
- Confirme que `generate-menu` aparece na lista

---

## Próximo Passo: Configurar OpenAI API Key

**No Dashboard do Supabase:**

1. Ir em **Edge Functions** (menu lateral)
2. Clicar em **Manage secrets**
3. Adicionar nova secret:
   - Nome: `OPENAI_API_KEY`
   - Valor: `sk-...` (sua chave da OpenAI)
4. Salvar

---

## Testar a Função

Após configurar a chave, testar:

```powershell
npx supabase functions invoke generate-menu --body '{
  "user_id": "test",
  "focus": "detox pós-festas",
  "duration_days": 7
}'
```

Se retornar JSON com cardápio, **está funcionando!** ✅
