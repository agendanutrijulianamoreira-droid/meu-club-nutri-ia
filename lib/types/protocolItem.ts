// Contrato TypeScript para protocol_items (Sub-fase 3 — Protocolos),
// espelhando o schema de supabase/migrations/20260722000004_protocolos_fundacao_biblioteca.sql
// e docs/architecture/sub-fase-3-protocolos.md (Seção 2.3).
//
// item_kind é o discriminador de domínio, não só do banco: o objetivo
// deste arquivo é isolar a lógica de "qual das 6 FKs mutuamente
// exclusivas está preenchida" e a regra de precedência override/mestre
// num só lugar, para o builder do PR2 não espalhar condicionais
// `if (item.recipe_id) ... else if (item.meal_id) ...` pela UI.

export type ProtocolItemKind = 'clinical_asset' | 'custom'

export type ClinicalAssetKind = 'recipe' | 'meal' | 'shot' | 'tea' | 'supplement' | 'material'

/** Linha crua de protocol_items, como vem do banco (todas as 6 FKs sempre presentes, nullable). */
export interface ProtocolItemRow {
  id: string
  protocol_day_id: string
  tenant_id: string
  item_kind: ProtocolItemKind
  recipe_id: string | null
  meal_id: string | null
  shot_id: string | null
  tea_id: string | null
  supplement_id: string | null
  material_id: string | null
  title: string
  description: string | null
  quantity: number | null
  unit: string | null
  serving_label: string | null
  time: string | null
  video_url: string | null
  image_url: string | null
  is_mandatory: boolean
  points: number
  points_camera: number | null
  points_gallery: number | null
  order_index: number
  created_at: string
}

/** Qual Ativo Clínico este item referencia, já resolvido — nunca mais de 1 (CHECK do banco garante). */
export type ClinicalAssetRef = { kind: ClinicalAssetKind; id: string }

type ClinicalAssetFkColumn = 'recipe_id' | 'meal_id' | 'shot_id' | 'tea_id' | 'supplement_id' | 'material_id'

const CLINICAL_ASSET_FK_MAP: Array<{ kind: ClinicalAssetKind; column: ClinicalAssetFkColumn }> = [
  { kind: 'recipe', column: 'recipe_id' },
  { kind: 'meal', column: 'meal_id' },
  { kind: 'shot', column: 'shot_id' },
  { kind: 'tea', column: 'tea_id' },
  { kind: 'supplement', column: 'supplement_id' },
  { kind: 'material', column: 'material_id' },
]

/**
 * Resolve qual das 6 FKs mutuamente exclusivas está preenchida, sem o
 * builder precisar checar cada coluna manualmente. Retorna null para
 * item_kind='custom' (nenhuma FK preenchida, por definição do CHECK).
 */
export function getClinicalAssetRef(item: Pick<ProtocolItemRow, 'item_kind' | ClinicalAssetFkColumn>): ClinicalAssetRef | null {
  if (item.item_kind === 'custom') return null
  for (const { kind, column } of CLINICAL_ASSET_FK_MAP) {
    const value = item[column]
    if (value) return { kind, id: value as string }
  }
  return null
}

/**
 * Regra de precedência de override (Seção 2.3 do documento de arquitetura):
 * coluna de protocol_items preenchida → usa o override; NULL → usa o
 * valor do Ativo Clínico mestre. Genérico porque a forma de buscar o
 * valor do mestre (join, shape da query) é decisão do PR2 — este helper
 * só encapsula o "??" para não ficar reimplementado em cada tela.
 */
export function resolveOverride<T>(overrideValue: T | null | undefined, masterValue: T | null | undefined): T | null {
  return overrideValue ?? masterValue ?? null
}
