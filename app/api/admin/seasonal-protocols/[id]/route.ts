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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: protocol, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .single()

  if (error || !protocol) return NextResponse.json({ error: 'Protocolo não encontrado' }, { status: 404 })

  const { data: days } = await supabase
    .from('protocol_days')
    .select('*, protocol_items(*)')
    .eq('protocol_id', protocol.id)
    .order('day_number')

  const sortedDays = (days || []).map((d: any) => ({
    ...d,
    protocol_items: (d.protocol_items || []).sort((a: any, b: any) => a.order_index - b.order_index),
  }))

  const { data: leads } = await supabase
    .from('protocol_leads')
    .select('*')
    .eq('protocol_id', protocol.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ protocol: { ...protocol, days: sortedDays }, leads: leads || [] })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing } = await supabase
    .from('protocols').select('id, standalone_slug').eq('id', params.id).eq('tenant_id', tenant.id).single()
  if (!existing) return NextResponse.json({ error: 'Protocolo não encontrado' }, { status: 404 })

  const body = await request.json()

  // Ação simples: apenas publicar/despublicar, sem tocar em dias/items
  if (typeof body.is_active === 'boolean' && Object.keys(body).length === 1) {
    const { error } = await supabase.from('protocols').update({ is_active: body.is_active }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const days = Array.isArray(body.days) ? body.days : []
  const allIngredients: string[] = []
  for (const day of days) {
    for (const item of day.items || []) {
      for (const ing of item.ingredients || []) allIngredients.push(ing)
    }
  }
  const shoppingList = Array.from(new Set(allIngredients.map((i: string) => i.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name }))

  let standaloneSlug: string | null = existing.standalone_slug || null
  if (body.is_standalone) {
    const desired = body.standalone_slug?.trim() ? slugify(body.standalone_slug) : (standaloneSlug || slugify(body.title || ''))
    if (desired && desired !== existing.standalone_slug) {
      const admin = getSupabaseAdmin()
      let candidate = desired
      let suffix = 1
      while (true) {
        const { data: clash } = await admin.from('protocols').select('id').eq('standalone_slug', candidate).neq('id', params.id).maybeSingle()
        if (!clash) break
        suffix += 1
        candidate = `${desired}-${suffix}`
      }
      standaloneSlug = candidate
    } else if (desired) {
      standaloneSlug = desired
    }
  }

  const { error: updateError } = await supabase
    .from('protocols')
    .update({
      title: body.title?.trim(),
      description: body.description || null,
      duration_days: days.length || body.duration_days,
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
    })
    .eq('id', params.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Substitui a hierarquia de dias/items (cascade remove os antigos)
  await supabase.from('protocol_days').delete().eq('protocol_id', params.id)

  for (const day of days) {
    const { data: dayRow, error: dayError } = await supabase
      .from('protocol_days')
      .insert([{ protocol_id: params.id, day_number: day.day_number, title: day.title, subtitle: day.subtitle || null }])
      .select()
      .single()

    if (dayError) continue

    const items = (day.items || []).map((item: any, idx: number) => ({
      protocol_day_id: dayRow.id,
      time: item.time || null,
      type: item.meal_type || 'meal',
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

    if (items.length > 0) await supabase.from('protocol_items').insert(items)

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

  return NextResponse.json({ success: true, standalone_slug: standaloneSlug })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('protocols').delete().eq('id', params.id).eq('tenant_id', tenant.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
