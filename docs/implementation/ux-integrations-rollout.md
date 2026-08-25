# Estratégia de implantação — UX, navegação e integrações

## Objetivo
Transformar o produto em uma operação mais legível, previsível e rápida para a nutricionista, reduzindo ruído visual e priorizando integrações que eliminam tarefas manuais.

## Princípios
1. **Legibilidade antes de estética:** nenhum texto, ícone ou estado crítico pode depender de baixo contraste.
2. **Menu por domínio, não por tela:** telas relacionadas vivem dentro de um mesmo grupo.
3. **Menos caminhos paralelos:** atalhos flutuantes e entradas duplicadas devem desaparecer quando o mesmo recurso já está no menu.
4. **Integração só entra se reduzir trabalho:** não integrar softwares que o produto pretende substituir.
5. **Segredos ficam no Vault:** a UI só cadastra/rotaciona; nunca reexibe credenciais privadas.
6. **Go-live controlado:** integração externa nasce desligada e só entra em produção depois de teste com conta real.

## Correção (Ago/2026)
A Onda 1 trocou os tokens globais (`app/globals.css`) e 5 arquivos de shell/navegação (`AdminClientPage.tsx`, `settings/vital/page.tsx`, `patient/layout.tsx`, `BottomNav.tsx`) para um tema claro, mas nunca migrou as ~30 views do admin nem as páginas da paciente que continuavam no tema escuro documentado no `CLAUDE.md` §4. Resultado: texto branco sobre fundo branco, cards `bg-white/5` e bordas `border-white/10` praticamente invisíveis em quase todo o sistema e no app — exatamente o problema relatado pela usuária ("não dá pra ver algumas coisas"). Correção aplicada: os 5 arquivos de shell voltaram ao tema escuro aprovado (`bg-slate-950`, `indigo-600`, `emerald/amber/rose` semânticos), preservando a reorganização da sidebar por domínio, a remoção dos atalhos flutuantes e o catálogo de integrações — não houve retrocesso de estrutura, só de paleta. Não recriar um tema claro global sem migrar as views existentes na mesma leva.

## Onda 1 — Base visual e navegação
### Entregas
- tokens semânticos de cor e contraste;
- reforço de placeholders, textos secundários, bordas, foco e estados;
- navegação da paciente com contraste superior;
- nova sidebar administrativa com grupos recolhíveis e nomes sempre visíveis;
- remoção do trilho de ícones com flyout;
- remoção da pilha de atalhos flutuantes da Home do Admin;
- acessos diretos para CRM, atendimento, planejamento clínico e configurações vitais.

### Critérios de aceite
- build e type-check sem erro novo;
- preview Vercel READY;
- nenhum item crítico do menu depende apenas de ícone;
- estados ativo/inativo têm contraste perceptível.

## Onda 2 — Central de serviços vitais
### Prioridade essencial
- Meta WhatsApp Cloud API;
- Google Workspace (Calendar, Meet e Drive);
- Google Gemini.

### Recomendadas
- Resend;
- Asaas;
- Zoom como alternativa ao Meet;
- Clicksign/ZapSign;
- n8n/Webhooks.

### Opcionais
- Mercado Pago;
- Stripe.

### Fora da prioridade
- WebDiet: o produto possui sua própria arquitetura para dietas/cardápios e não deve depender de um sistema que pretende substituir.

## Onda 3 — Adapters e go-live
Cada integração segue a mesma sequência:
1. cadastrar credenciais na Central;
2. validar conectividade server-side;
3. registrar estado `draft/configured/verified/live` quando aplicável;
4. executar teste em tenant/número/conta de piloto;
5. ativar uso real apenas após verificação;
6. registrar erros e auditoria sem expor segredo.

## Ordem operacional recomendada
1. Meta WhatsApp — concluir go-live real;
2. Google Calendar + Meet — agenda e videoconsulta;
3. Asaas — cobrança, Pix e recorrência;
4. Resend — e-mail transacional;
5. Google Drive — documentos e materiais;
6. assinatura digital — termos/consentimentos;
7. n8n — integrações de cauda longa;
8. alternativas (Zoom, Mercado Pago, Stripe).

## Rollback
Mudanças visuais e de navegação devem ser isoladas em PR próprio. Integrações externas devem entrar em PRs separados por provedor, sempre com default desligado. Não criar filas paralelas quando já existir uma fonte de verdade operacional.
