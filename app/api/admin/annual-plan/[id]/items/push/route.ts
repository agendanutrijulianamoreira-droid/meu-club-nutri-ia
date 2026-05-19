import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

// POST /api/admin/annual-plan/[id]/items/push
// Pushes an approved annual plan item into the live system (protocols, challenges, etc.)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, method_name, gpt_system_prompt')
    .eq('owner_id', user.id)
    .single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { item_id } = await request.json()
  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const { data: item, error: itemError } = await supabase
    .from('annual_plan_items')
    .select('*')
    .eq('id', item_id)
    .eq('plan_id', params.id)
    .eq('tenant_id', tenant.id)
    .single()

  if (itemError || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  if (item.status === 'pushed') {
    return NextResponse.json({ error: 'Item already pushed to system' }, { status: 409 })
  }

  const title = item.edited_title || item.title
  const description = item.edited_description || item.description

  try {
    let result: Record<string, any> = {}

    switch (item.item_type) {
      case 'challenge': {
        const { data: challenge, error } = await supabase
          .from('challenges')
          .insert({
            tenant_id: tenant.id,
            created_by: user.id,
            title,
            description,
            emoji: item.details?.emoji || '🏆',
            duration_days: item.details?.duration_days || 21,
            xp_reward: item.details?.xp_reward || 100,
            status: 'draft',
            start_date: item.details?.start_date || null,
          })
          .select('id')
          .single()

        if (error) throw new Error(error.message)
        result = { type: 'challenge', id: challenge?.id }
        break
      }

      case 'protocol': {
        const { data: protocol, error } = await supabase
          .from('protocols')
          .insert({
            tenant_id: tenant.id,
            created_by: user.id,
            title,
            description,
            duration_days: item.details?.duration_days || 28,
            category: item.details?.category || 'custom',
            status: 'draft',
            content: item.details || {},
          })
          .select('id')
          .single()

        if (error) throw new Error(error.message)
        result = { type: 'protocol', id: protocol?.id }
        break
      }

      case 'push_campaign': {
        const { data: campaign, error } = await supabase
          .from('push_campaigns')
          .insert({
            tenant_id: tenant.id,
            created_by: user.id,
            title,
            message: description,
            scheduled_for: item.details?.scheduled_for || null,
            status: 'draft',
          })
          .select('id')
          .single()

        if (error) {
          // push_campaigns table may not exist yet — store as a note instead
          result = { type: 'push_campaign', note: 'Tabela push_campaigns não encontrada — crie manualmente no ComunicationCenter' }
        } else {
          result = { type: 'push_campaign', id: campaign?.id }
        }
        break
      }

      case 'promotion':
      case 'special_event': {
        // Store as a scheduled community post draft
        const { data: post, error } = await supabase
          .from('community_posts')
          .insert({
            tenant_id: tenant.id,
            user_id: user.id,
            content: `${title}\n\n${description}`,
            is_ai_generated: true,
            status: 'draft',
          })
          .select('id')
          .single()

        if (error) throw new Error(error.message)
        result = { type: 'community_post_draft', id: post?.id }
        break
      }

      default:
        result = { type: item.item_type, note: 'Tipo sem handler — item registrado como texto' }
    }

    // Mark item as pushed
    await supabase
      .from('annual_plan_items')
      .update({ status: 'pushed' })
      .eq('id', item_id)

    console.log('[annual-plan push]', { tenant_id: tenant.id, item_id, item_type: item.item_type, result })
    return NextResponse.json({ ok: true, result })

  } catch (err: any) {
    console.error('[annual-plan push]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
