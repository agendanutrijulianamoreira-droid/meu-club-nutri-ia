-- ============================================================
-- Arquitetura "Método Clínico" — Sub-fase 1: endurecimento pré-merge
-- Ajustes de padronização e integridade referencial identificados
-- na revisão arquitetural da PR: nomenclatura consistente com o
-- resto do projeto, updated_at em method_phases, created_by em
-- methods, e explicitação do ON DELETE em fase_paciente.
-- 2026-07-21
-- ============================================================

-- ------------------------------------------------------------
-- 1. Padronização de nome: order_index → sort_order.
--    Todo o resto do projeto (habits, products, meal_plan_items,
--    seed_content) usa "sort_order" para colunas de ordem de
--    exibição — order_index era uma inconsistência isolada.
-- ------------------------------------------------------------

ALTER TABLE method_phases RENAME COLUMN order_index TO sort_order;

-- Índice antigo referenciava a coluna por nome; recriar por clareza
-- (o Postgres já atualiza o índice existente automaticamente no
-- RENAME COLUMN, este DROP/CREATE é só para manter o nome do índice
-- consistente com a nova coluna).
DROP INDEX IF EXISTS idx_method_phases_method;
CREATE INDEX IF NOT EXISTS idx_method_phases_sort ON method_phases(method_id, sort_order);

-- ------------------------------------------------------------
-- 2. method_phases ganha updated_at (é conteúdo editável pelo
--    admin — nome/descrição/ordem mudam ao longo do tempo,
--    igual a "methods").
-- ------------------------------------------------------------

ALTER TABLE method_phases ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS trg_method_phases_updated_at ON method_phases;
CREATE TRIGGER trg_method_phases_updated_at
  BEFORE UPDATE ON method_phases
  FOR EACH ROW EXECUTE FUNCTION update_methods_updated_at();

-- ------------------------------------------------------------
-- 3. methods ganha created_by — mesmo padrão usado em entidades
--    autoradas pelo admin no projeto (ex. meal_plans.created_by,
--    patient_records, communication_center).
-- ------------------------------------------------------------

ALTER TABLE methods ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- ------------------------------------------------------------
-- 4. fase_paciente.method_phase_id: explicita ON DELETE RESTRICT.
--    Justificativa: fase_paciente é histórico clínico (inicio/fim/
--    observações). Um CASCADE apagaria silenciosamente o registro
--    histórico da paciente se a fase fosse removida; SET NULL
--    perderia a rastreabilidade de qual fase foi aplicada sem
--    avisar ninguém. RESTRICT força a nutricionista a reatribuir
--    as pacientes daquela fase antes de poder excluí-la — a opção
--    mais segura para dado clínico. Antes desta migration o
--    comportamento já era equivalente (NO ACTION, default do
--    Postgres); aqui só o tornamos explícito e documentado.
-- ------------------------------------------------------------

ALTER TABLE fase_paciente DROP CONSTRAINT IF EXISTS fase_paciente_method_phase_id_fkey;
ALTER TABLE fase_paciente
  ADD CONSTRAINT fase_paciente_method_phase_id_fkey
  FOREIGN KEY (method_phase_id) REFERENCES method_phases(id) ON DELETE RESTRICT;
