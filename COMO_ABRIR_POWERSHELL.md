# 💻 O QUE É POWERSHELL E COMO ABRIR

## 🤔 O QUE É POWERSHELL?

PowerShell é o **terminal/console do Windows**. É onde você digita comandos de texto para fazer coisas no computador.

Pense nele como uma "linha de comando" - em vez de clicar em botões, você digita instruções.

---

## 🚀 COMO ABRIR POWERSHELL COMO ADMINISTRADOR

### **MÉTODO 1: Mais Rápido (Recomendado)**

1. **Pressione** a tecla **Windows** (⊞) no teclado
2. **Digite:** `powershell`
3. **Aparecerá:** "Windows PowerShell"
4. **Clique com botão direito** nele
5. **Selecione:** "Executar como administrador"
6. **Clique "Sim"** na janela de permissão
7. ✅ PowerShell vai abrir com fundo **azul escuro**

### **MÉTODO 2: Via Menu Iniciar**

1. **Clique** no ícone do **Windows** (canto inferior esquerdo)
2. **Role para baixo** até encontrar a pasta **"Windows PowerShell"**
3. **Clique com botão direito** em **"Windows PowerShell"**
4. **Mais** → **"Executar como administrador"**
5. **Clique "Sim"**
6. ✅ Abriu!

### **MÉTODO 3: Via Executar**

1. **Pressione:** `Win + R`
2. **Digite:** `powershell`
3. **Pressione:** `Ctrl + Shift + Enter` (isso força como admin)
4. **Clique "Sim"**
5. ✅ Abriu!

---

## 🎯 COMO SABER SE É ADMINISTRADOR?

Quando o PowerShell abre como administrador, você verá:

### **No Título da Janela:**
```
Administrador: Windows PowerShell
```

### **No Início da Linha:**
```powershell
PS C:\Windows\System32>
```

Se NÃO for administrador, verá:
```powershell
PS C:\Users\Nutri>
```

---

## 📝 COMANDOS QUE VOCÊ VAI EXECUTAR

Depois de abrir o PowerShell como administrador, copie e cole estes comandos:

### 1. Instalar Supabase CLI
```powershell
npm install -g supabase
```
**Aguarde:** 1-2 minutos instalando

### 2. Login no Supabase
```powershell
supabase login
```
**O que acontece:** Abre navegador → Clique "Authorize" → Volte ao PowerShell

### 3. Navegar até o projeto
```powershell
cd c:/Users/Nutri/.gemini/antigravity/playground/ionized-kepler
```

### 4. Linkar projeto
```powershell
supabase link --project-ref antszuxeairmbctwuafo
```
**Pergunta senha:** Digite a senha do seu banco Supabase

### 5. Deploy da função
```powershell
supabase functions deploy generate-protocol
```
**Aguarde:** 30-60 segundos

---

## 💡 DICAS

### Como Copiar/Colar no PowerShell:

**Copiar:**
- Selecione o texto
- Clique com botão direito (copia automaticamente)

**Colar:**
- Clique com botão direito (cola automaticamente)
- OU: `Ctrl + V`

### Se Der Erro de Permissão:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Digite `S` e pressione Enter

### Para Limpar a Tela:
```powershell
cls
```
ou `Ctrl + L`

---

## ❓ PERGUNTAS COMUNS

### "Posso fechar o PowerShell depois?"
**Sim!** Depois de executar os comandos, pode fechar normalmente.

### "Preciso deixar aberto?"
**Não!** Só precisa estar aberto durante a execução dos comandos.

### "E se eu errar ao digitar?"
Use as **setas ← →** para navegar e corrigir, ou `Backspace` para apagar.

### "E se der erro?"
Copie a mensagem de erro e me envie! Vou te ajudar a resolver.

---

## ✅ CHECKLIST VISUAL

Siga esta ordem:

```
┌─────────────────────────────────┐
│ 1. Pressione tecla Windows (⊞)  │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ 2. Digite "powershell"          │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ 3. Botão direito → Admin        │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ 4. Clique "Sim"                 │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ ✅ PowerShell Aberto!           │
│    (fundo azul escuro)          │
└─────────────────────────────────┘
```

---

## 🎬 RESUMO RÁPIDO

1. **Windows** (⊞) → Digite `powershell`
2. **Botão direito** → "Executar como administrador"
3. **Sim**
4. ✅ **Pronto para executar comandos!**

---

**ABRA O POWERSHELL E ME AVISE QUANDO ESTIVER PRONTO!** 🚀

Se conseguiu abrir, o próximo passo é executar os comandos que vou te passar.
