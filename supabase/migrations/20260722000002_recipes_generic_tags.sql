-- ============================================================
-- Sub-fase 2 (Biblioteca Clínica) — correção pontual: recipes
-- precisa de uma coluna "tags" genérica separada de dietary_tags.
--
-- dietary_tags tem semântica própria e já em uso (filtro de
-- restrição alimentar da paciente — lactose, glúten, vegana em
-- app/api/patient/recipes/route.ts). O contrato de Ativo Clínico
-- (ADR-0002) pede uma coluna "tags" genérica e descritiva (ex.:
-- anti-inflamatório, SOP, Fase 1) igual às demais entidades da
-- Biblioteca Clínica — não deve ser sobrecarregada em dietary_tags.
-- ============================================================

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_recipes_tags_generic ON recipes USING GIN(tags);
