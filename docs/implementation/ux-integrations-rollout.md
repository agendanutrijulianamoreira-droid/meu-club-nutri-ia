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

## Arquitetura visual v3
O produto não possui um único tema global. Cada contexto tem identidade e tokens próprios:
- **Admin operacional:** `theme-admin-light` — fundo claro, superfícies brancas, texto escuro e teal para ação/navegação.
- **Views administrativas legadas densas:** podem manter superfícies dark localmente durante a migração, mas nunca alterando `:root`.
- **Paciente:** `theme-patient` — creme `#F4EFE4`, chocolate `#2B1A10`, dourado `#C9A435` e superfícies brancas.
- **Autenticação:** `theme-auth` — dark/indigo, isolado das áreas autenticadas.

Regras de segurança visual:
- nunca definir `text-white` ou outra cor de texto em `h1,h2,h3` globais;
- nunca trocar `--background` global para resolver uma única área;
- componentes de shell devem declarar explicitamente seu tema;
- contraste deve ser validado no contexto real da rota, não só por build;
- Admin e Paciente devem ser auditados separadamente.

## Onda 1 — Base visual e navegação
### Entregas
- tokens semânticos de cor e contraste escopados por contexto;
- reforço de placeholders, textos secundários, bordas, foco e estados;
- identidade creme/dourado preservada na navegação da paciente;
- nova sidebar administrativa com um grupo aberto por vez;
- drawer responsivo no Admin para telas menores;
- shell persistente nas rotas administrativas independentes (CRM, agenda, comunicação, configurações etc.);
- remoção do trilho de ícones com flyout;
- remoção da pilha de atalhos flutuantes da Home do Admin;
- acessos diretos para CRM, atendimento, planejamento clínico e configurações vitais.

### Critérios de aceite
- build e type-check sem erro novo;
- preview Vercel READY;
- nenhum item crítico do menu depende apenas de ícone;
- estados ativo/inativo têm contraste perceptível;
- abrir uma rota administrativa independente não elimina a navegação principal;
- Home da paciente mantém fundo creme, texto chocolate e navegação dourada coerente.

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
