# ADR 0005 — Regras de domínio configuráveis por tenant

## Status
Aceito.

## Contexto
O sistema precisa suportar tanto mudanças futuras no método clínico atual quanto a entrada de outras nutricionistas com métodos, cadências e critérios diferentes. Regras como dias de inatividade, limiares de adesão, critérios de avanço, janelas de vencimento, horários operacionais e habilitação de automações não podem exigir alteração de código sempre que a decisão clínica ou operacional mudar.

## Decisão
Toda regra de domínio que possa variar por nutricionista, clínica, método, protocolo, fase ou estratégia operacional deve ser persistida e editável no Admin no nível correto de escopo.

### Escopos
- `tenant`: regras operacionais compartilhadas pela clínica, como acompanhamento, risco, prazos, janelas e automações.
- `method` / `method_phase`: decisões clínicas específicas do método e de cada fase, como critérios de avanço.
- `protocol` / `challenge`: regras próprias da intervenção, quando aplicável.
- `user`: apenas preferências pessoais de interface ou trabalho que não alteram a regra clínica da clínica.

## Princípios
1. Valores no código são apenas defaults seguros para inicialização e compatibilidade.
2. Se um valor puder razoavelmente mudar por decisão clínica ou operacional, ele não deve ser uma constante oculta.
3. O motor deve ler a configuração persistida e registrar de forma explicável quais regras foram aplicadas.
4. Configurações devem ter validação de consistência e fallback seguro.
5. Alterar uma configuração não pode exigir deploy.
6. Mudanças de configuração não devem executar ações irreversíveis automaticamente sem uma regra explícita de autorização.
7. Configurações de uma clínica nunca podem afetar outra clínica.
8. Novas fases do roadmap devem passar por revisão de hardcodes antes do gate de conclusão.

## Aplicação inicial na Fase 2
`tenant_followup_settings` passa a ser a fonte de verdade das regras variáveis do Motor de Acompanhamento, incluindo:
- faixas de inatividade;
- limiares de adesão;
- atraso de check-in;
- janelas de vencimento de plano;
- janelas de término de protocolo;
- horários e validade das tarefas;
- habilitação futura de contato automático.

Critérios de avanço de fase permanecem em `method_phases.advancement_criteria`, pois pertencem à fase do método, não ao tenant inteiro.

## Consequências
- outra nutricionista pode configurar o próprio fluxo sem fork do código;
- Juliana pode mudar decisões futuras diretamente no Admin;
- aumenta a necessidade de validação, versionamento e auditoria de configurações;
- regras técnicas invariantes de segurança, integridade e autorização continuam no código/banco e não são editáveis.

## Exceções
Não são configuráveis regras que comprometam isolamento de tenant, autenticação, RLS, integridade referencial, proteção de dados, atomicidade ou outros invariantes técnicos de segurança.