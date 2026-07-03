// Ponte entre o formato "gateway product" (usado pela UI de ProductGatewayView
// e pela vitrine /patient/gateway) e a tabela unificada `products` (ver
// migration 20260703000003_unify_product_catalog.sql). Existiam dois
// catálogos de produto duplicados — este arquivo evita reescrever as views
// imediatamente enquanto o dado já vive num lugar só.

export const GATEWAY_TYPES = ['consultation', 'method_90d', 'genetic_test', 'custom'] as const

const TYPE_TO_GATEWAY: Record<string, string> = { method_90d: 'program_90d' }
const TYPE_FROM_GATEWAY: Record<string, string> = { program_90d: 'method_90d' }

export interface GatewayProductShape {
  id?: string
  name: string
  description?: string
  short_pitch?: string
  product_type: 'consultation' | 'program_90d' | 'genetic_test' | 'custom'
  price_label?: string
  cta_text: string
  external_url?: string
  badge_text?: string
  trigger_type: 'manual' | 'after_days' | 'after_checkins' | 'high_engagement' | 'low_adherence'
  trigger_value?: number
  visible_to_plans: string[]
  display_order: number
  is_active: boolean
}

export function fromProductRow(row: any): GatewayProductShape {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    short_pitch: row.short_description || '',
    product_type: (TYPE_TO_GATEWAY[row.type] || row.type) as GatewayProductShape['product_type'],
    price_label: row.price_label_legacy || (row.price_cents ? `R$ ${(row.price_cents / 100).toFixed(2)}` : ''),
    cta_text: row.cta_text || 'Quero saber mais',
    external_url: row.external_url || '',
    badge_text: row.badge_text || '',
    trigger_type: row.trigger_type || 'manual',
    trigger_value: row.trigger_value ?? undefined,
    visible_to_plans: row.visible_to_plans || ['community', 'tech_diet', 'vip'],
    display_order: row.sort_order ?? 0,
    is_active: row.is_active !== false,
  }
}

export function toProductRow(shape: Partial<GatewayProductShape>): Record<string, any> {
  const row: Record<string, any> = {}
  if (shape.name !== undefined) row.name = shape.name
  if (shape.description !== undefined) row.description = shape.description
  if (shape.short_pitch !== undefined) row.short_description = shape.short_pitch
  if (shape.product_type !== undefined) row.type = TYPE_FROM_GATEWAY[shape.product_type] || shape.product_type
  if (shape.price_label !== undefined) row.price_label_legacy = shape.price_label
  if (shape.cta_text !== undefined) row.cta_text = shape.cta_text
  if (shape.external_url !== undefined) row.external_url = shape.external_url
  if (shape.badge_text !== undefined) row.badge_text = shape.badge_text
  if (shape.trigger_type !== undefined) row.trigger_type = shape.trigger_type
  if (shape.trigger_value !== undefined) row.trigger_value = shape.trigger_value
  if (shape.visible_to_plans !== undefined) row.visible_to_plans = shape.visible_to_plans
  if (shape.display_order !== undefined) row.sort_order = shape.display_order
  if (shape.is_active !== undefined) row.is_active = shape.is_active
  return row
}
