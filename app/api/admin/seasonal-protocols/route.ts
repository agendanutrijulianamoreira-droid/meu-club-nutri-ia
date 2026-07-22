import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { upsertFoodsFromIngredients, saveRecipeFromItem } from '@/lib/services/foodBank'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase.from('tenants').select('id').eq('owner_id', userId).single()
  return data
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: protocols, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('category', 'seasonal')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ protocols: protocols || [] })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  if (!body.title?.trim()) return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })

  const days = Array.isArray(body.days) ? body.days : []

  // Todos os ingredientes citados, para dedupe da lista de compras e banco de alimentos
  const allIngredients: string[] = []
  for (const day of days) {
    for (const item of day.items || []) {
      for (const ing of item.ingredients || []) allIngredients.push(ing)
    }
  }
  const shoppingList = Array.from(new Set(allIngredients.map((i: string) => i.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name }))

  let standaloneSlug: string | null = null
  if (body.is_standalone) {
    standaloneSlug = body.standalone_slug?.trim() ? slugify(body.standalone_slug) : slugify(body.title)
    if (!standaloneSlug) standaloneSlug = `protocolo-${Date.now()}`
    // Garante unicidade global do slug — usa client admin pois o slug é único entre TODOS os
    // tenants e a RLS do client de sessão só enxerga protocolos do próprio tenant.
    const admin = getSupabaseAdmin()
    let candidate = standaloneSlug
    let suffix = 1
    while (true) {
      const { data: clash } = await admin.from('protocols').select('id').eq('standalone_slug', candidate).maybeSingle()
      if (!clash) break
      suffix += 1
      candidate = `${standaloneSlug}-${suffix}`
    }
    standaloneSlug = candidate
  }

  const { data: protocol, error: protocolError } = await supabase
    .from('protocols')
    .insert([{
      tenant_id: tenant.id,
      title: body.title.trim(),
      description: body.description || null,
      category: 'seasonal',
      duration_days: days.length || body.duration_days || 7,
      goals: body.goals || [],
      shopping_list: shoppingList,
      cover_image_url: body.cover_image_url || null,
      upsell_title: body.upsell_title || null,
      upsell_message: body.upsell_message || null,
      upsell_cta_label: body.upsell_cta_label || null,
      upsell_cta_url: body.upsell_cta_url || null,
      is_standalone: !!body.is_standalone,
      standalone_slug: standaloneSlug,
      standalone_price_cents: body.standalone_price_cents || null,
      sales_headline: body.sales_headline || null,
      sales_description: body.sales_description || null,
      is_active: false,
      is_template: true,
    }])
    .select()
    .single()

  if (protocolError) return NextResponse.json({ error: protocolError.message }, { status: 500 })

  for (const day of days) {
    const { data: dayRow, error: dayError } = await supabase
      .from('protocol_days')
      .insert([{ protocol_id: protocol.id, tenant_id: tenant.id, day_number: day.day_number, title: day.title, subtitle: day.subtitle || null }])
      .select()
      .single()

    if (dayError) {
      console.error('[seasonal-protocols] protocol_days insert', dayError)
      return NextResponse.json({ error: `Falha ao salvar dia ${day.day_number}: ${dayError.message}` }, { status: 500 })
    }

    const items = (day.items || []).map((item: any, idx: number) => ({
      protocol_day_id: dayRow.id,
      tenant_id: tenant.id,
      time: item.time || null,
      type: item.meal_type || 'meal',
      item_kind: 'custom',
      title: item.title,
      description: item.description || null,
      ingredients: item.ingredients || null,
      recipe: item.recipe || null,
      image_url: item.image_url || null,
      is_mandatory: item.is_mandatory ?? true,
      points: item.points || 10,
      points_camera: item.points_camera || item.points || 10,
      points_gallery: item.points_gallery || item.points || 10,
      order_index: idx,
    }))

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('protocol_items').insert(items)
      if (itemsError) {
        console.error('[seasonal-protocols] protocol_items insert', itemsError)
        return NextResponse.json({ error: `Falha ao salvar itens do dia ${day.day_number}: ${itemsError.message}` }, { status: 500 })
      }
    }

    for (const item of day.items || []) {
      if (item.recipe?.trim()) {
        saveRecipeFromItem({
          tenantId: tenant.id,
          title: item.title,
          ingredients: item.ingredients || [],
          instructions: item.recipe,
          mealType: item.meal_type,
          imageUrl: item.image_url,
        }).catch(err => console.error('[seasonal-protocols] saveRecipeFromItem', err))
      }
    }
  }

  if (allIngredients.length > 0) {
    upsertFoodsFromIngredients(allIngredients).catch(err => console.error('[seasonal-protocols] upsertFoods', err))
  }

  return NextResponse.json({ success: true, id: protocol.id, standalone_slug: standaloneSlug })
}
