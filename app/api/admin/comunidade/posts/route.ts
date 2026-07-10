import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/admin/comunidade/posts — lista posts do tenant
export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: posts, error } = await supabase
        .from('community_posts')
        .select('id, type, body, is_pinned, oculto, nivel_minimo, created_at, user_id')
        .eq('tenant_id', tenant.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const authorIds = Array.from(new Set((posts || []).map(p => p.user_id as string)))
    const { data: authors } = await supabase
        .from('profiles').select('user_id, name').in('user_id', authorIds)
    const authorMap: Record<string, string> = {}
    for (const a of authors || []) authorMap[a.user_id] = a.name

    // Buscar contagem de reações por post
    const postIds = (posts || []).map(p => p.id)
    const { data: reactions } = await supabase
        .from('community_reactions')
        .select('post_id')
        .in('post_id', postIds)

    const reactionCounts: Record<string, number> = {}
    for (const r of reactions || []) {
        reactionCounts[r.post_id] = (reactionCounts[r.post_id] || 0) + 1
    }

    const enriched = (posts || []).map(p => ({
        ...p,
        author_name: authorMap[p.user_id] || 'Rainha',
        reaction_count: reactionCounts[p.id] || 0,
    }))

    return NextResponse.json({ posts: enriched })
}

// POST /api/admin/comunidade/posts — criar novo post
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()

    // Suporte a ações legadas (pin, ocultar, delete) e criação de posts
    if (body.action && body.post_id) {
        if (body.action === 'pin') {
            const { data: post } = await supabase
                .from('community_posts').select('is_pinned').eq('id', body.post_id).single()
            if (post) {
                await supabase.from('community_posts')
                    .update({ is_pinned: !post.is_pinned })
                    .eq('id', body.post_id).eq('tenant_id', tenant.id)
            }
            return NextResponse.json({ ok: true })
        }
        if (body.action === 'ocultar') {
            const { data: post } = await supabase
                .from('community_posts').select('oculto').eq('id', body.post_id).single()
            if (post) {
                await supabase.from('community_posts')
                    .update({ oculto: !post.oculto })
                    .eq('id', body.post_id).eq('tenant_id', tenant.id)
            }
            return NextResponse.json({ ok: true })
        }
        if (body.action === 'delete') {
            await supabase.from('community_posts')
                .delete().eq('id', body.post_id).eq('tenant_id', tenant.id)
            return NextResponse.json({ ok: true })
        }
    }

    // Criação de post normal
    const text = (body.body || '').trim()
    if (!text || text.length > 1000) {
        return NextResponse.json({ error: 'Texto inválido (1-1000 caracteres)' }, { status: 400 })
    }
    const type = body.type || 'system'
    const nivel_minimo = Number(body.nivel_minimo) || 1
    const is_pinned = body.is_pinned === true

    const { data: post, error } = await supabase
        .from('community_posts')
        .insert({
            tenant_id: tenant.id,
            user_id: user.id,
            type,
            body: text,
            is_pinned,
            nivel_minimo,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ post })
}
