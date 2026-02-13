# ⚠️ ERRO: Execução de Scripts Desabilitada

## 🔧 SOLUÇÃO RÁPIDA

Você viu este erro:
```
npm : O arquivo C:\Program Files\nodejs\npm.ps1 não pode ser carregado porque a execução de scripts foi desabilitada neste sistema
```

**Isso é normal!** Windows bloqueia scripts por segurança.

---

## ✅ COMANDO PARA RESOLVER

No PowerShell que está aberto como Administrador, copie e cole:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

**Pressione Enter**

**Vai aparecer algo como:**
```
Mudou a política de execução com sucesso
```

ou simplesmente volta para a linha de comando normal.

---

## 🔄 AGORA TENTE NOVAMENTE

Depois de executar o comando acima, tente instalar o Supabase novamente:

```powershell
npm install -g supabase
```

**Pressione Enter**

**Aguarde 1-2 minutos...**

**Sucesso quando ver:**
```
added X packages in Xs
```

---

## 📋 RESUMO DOS COMANDOS NA ORDEM

Cole um por vez:

### 1. Desbloquear scripts:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### 2. Instalar Supabase CLI:
```powershell
npm install -g supabase
```

### 3. Login:
```powershell
supabase login
```

### 4. Navegar para o projeto:
```powershell
cd c:/Users/Nutri/.gemini/antigravity/playground/ionized-kepler
```

### 5. Linkar projeto:
```powershell
supabase link --project-ref antszuxeairmbctwuafo
```

### 6. Deploy:
```powershell
supabase functions deploy generate-protocol
```

---

## 💡 O QUE FAZ ESSE COMANDO?

`Set-ExecutionPolicy RemoteSigned`:
- Permite executar scripts no PowerShell
- Só afeta o seu usuário (`-Scope CurrentUser`)
- É seguro! É necessário para ferramentas como npm, supabase, etc.

---

**EXECUTE O COMANDO DE DESBLOQUEIO E TENTE INSTALAR NOVAMENTE!** 🚀

Me avise se funcionou ou se aparecer outro erro!
