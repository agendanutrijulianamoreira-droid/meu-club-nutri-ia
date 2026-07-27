-- ============================================================
-- Correção do fluxo de salvamento de Protocolos (ProtocolsView.tsx):
-- o formulário "Novo Protocolo"/"Editar Protocolo" gravava a estrutura de
-- dias/tarefas em `protocols.content` (jsonb solto) e nunca escrevia em
-- protocol_days/protocol_items — as tabelas relacionais que o app da
-- paciente (useAssignments) e a página pública de protocolos standalone
-- (/api/public/protocols/[slug]) realmente leem. Resultado: todo protocolo
-- criado pela tela "Protocolos" aparecia sem nenhum dia/tarefa em qualquer
-- lugar que não fosse o próprio formulário de edição.
--
-- app/admin/views/ProtocolsView.tsx e lib/hooks/useDatabase.ts (createProtocol/
-- updateProtocol) foram corrigidos para gravar direto em protocol_days/
-- protocol_items. Esta migração é só o backfill único do que já existia em
-- produção antes da correção: 3 protocolos, todos do mesmo tenant, 0 linhas
-- em protocol_days para todos — só "Protocolo GLP-1 Ativo..." tinha conteúdo
-- de fato (1 dia, 4 itens) dentro de `content`; os outros 2 têm
-- `content = '[]'` (nada a migrar).
-- ============================================================

DO $$
DECLARE
  v_protocol RECORD;
  v_day JSONB;
  v_item JSONB;
  v_day_id UUID;
  v_day_number INTEGER;
  v_order INTEGER;
BEGIN
  FOR v_protocol IN
    SELECT id, tenant_id, content
    FROM protocols
    WHERE jsonb_array_length(content) > 0
      AND NOT EXISTS (SELECT 1 FROM protocol_days WHERE protocol_days.protocol_id = protocols.id)
  LOOP
    FOR v_day IN SELECT * FROM jsonb_array_elements(v_protocol.content)
    LOOP
      v_day_number := COALESCE((v_day->>'day')::integer, (v_day->>'day_number')::integer);

      INSERT INTO protocol_days (protocol_id, tenant_id, day_number, title, subtitle)
      VALUES (
        v_protocol.id,
        v_protocol.tenant_id,
        v_day_number,
        COALESCE(NULLIF(v_day->>'title', ''), 'Dia ' || v_day_number),
        NULL
      )
      RETURNING id INTO v_day_id;

      v_order := 0;
      FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_day->'items', '[]'::jsonb))
      LOOP
        INSERT INTO protocol_items (
          protocol_day_id, tenant_id, type, item_kind, time, title, description, points, is_mandatory, order_index
        ) VALUES (
          v_day_id,
          v_protocol.tenant_id,
          CASE v_item->>'item_type'
            WHEN 'exercise' THEN 'workout'
            WHEN 'habit' THEN 'custom'
            ELSE COALESCE(NULLIF(v_item->>'item_type', ''), 'custom')
          END,
          'custom',
          NULLIF(v_item->>'time', '')::time,
          COALESCE(v_item->>'title', ''),
          NULLIF(v_item->>'description', ''),
          COALESCE((v_item->>'points')::integer, 10),
          true,
          v_order
        );
        v_order := v_order + 1;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
