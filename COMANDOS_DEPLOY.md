# 🚀 COMANDOS PARA COPIAR E COLAR

**Abra o PowerShell como Administrador primeiro!**
(Veja: COMO_ABRIR_POWERSHELL.md)

---

## 📋 COMANDO 1: Instalar Supabase CLI

Copie esta linha inteira e cole no PowerShell:

```powershell
npm install -g supabase
```

**Pressione Enter**

**Aguarde:** 1-2 minutos instalando pacotes...

**Sucesso quando ver:**
```
added X packages in Xs
```

---

## 🔑 COMANDO 2: Login no Supabase

```powershell
supabase login
```

**Pressione Enter**

**O que vai acontecer:**
1. Abre uma página no navegador
2. Clique no botão **"Authorize"**
3. Volte ao PowerShell
4. Verá: "✔ Logged in."

---

## 📂 COMANDO 3: Ir para a pasta do projeto

```powershell
cd c:/Users/Nutri/.gemini/antigravity/playground/ionized-kepler
```

**Pressione Enter**

**Vai mudar para:**
```
PS C:\Users\Nutri\.gemini\antigravity\playground\ionized-kepler>
```

---

## 🔗 COMANDO 4: Linkar projeto Supabase

```powershell
supabase link --project-ref antszuxeairmbctwuafo
```

**Pressione Enter**

**Vai pedir:**
```
Enter your database password:
```

**Digite a senha do seu banco Supabase** (não vai aparecer enquanto digita - é normal!)

**Pressione Enter**

**Sucesso quando ver:**
```
✔ Finished supabase link.
```

**Não sabe a senha?**
1. Vá em: https://supabase.com/dashboard/project/antszuxeairmbctwuafo/settings/database
2. Clique "Reset Database Password"
3. Defina nova senha
4. Use ela aqui

---

## 🚀 COMANDO 5: Deploy da Edge Function

```powershell
supabase functions deploy generate-protocol
```

**Pressione Enter**

**Aguarde:** 30-60 segundos...

**Sucesso quando ver:**
```
✔ Deployed Function generate-protocol
```

---

## ✅ PRONTO!

Agora você só precisa configurar a chave OpenAI no dashboard:

1. **Vá em:**
   ```
   https://supabase.com/dashboard/project/antszuxeairmbctwuafo/settings/functions
   ```

2. **Clique em:** "Add secret" ou "Manage secrets"

3. **Preencha:**
   ```
   Name: OPENAI_API_KEY
   Value: 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
   ```

4. **Clique "Save"**

---

## 🎯 TESTAR

1. **Abra:** http://localhost:3000/admin/protocols/new
2. **Clique:** "✨ Gerar com IA"
3. **Digite:** "Protocolo detox de 3 dias"
4. **Aguarde:** 15-30 segundos
5. ✅ **Protocolo será gerado pela OpenAI real!**

---

## 🐛 SE DER ERRO

### Erro: "comando não encontrado"
→ Verifique se está como **Administrador**
→ Título deve mostrar: "Administrador: Windows PowerShell"

### Erro ao fazer link
→ Senha incorreta, tente novamente

### Erro no deploy
→ Me envie o erro completo!

---

**EXECUTE COMANDO POR COMANDO E ME AVISE QUANDO FINALIZAR!** 🚀
