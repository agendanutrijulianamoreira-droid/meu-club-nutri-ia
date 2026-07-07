import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET: list recent posts for admin moderation
export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: posts } = await supabase
        .from('community_posts')
        .select(`
            id, type, body, meta, is_pinned, oculto, nivel_minimo, created_at, user_id,
            community_reactions(count)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50)

    // Enrich with author names
    const authorIds = Array.from(new Set((posts || []).map(p => p.user_id as string)))
    const { data: authors } = await supabase
        .from('profiles').select('user_id, name, role').in('user_id', authorIds)
    const authorMap: Record<string, any> = {}
    for (const a of authors || []) authorMap[a.user_id] = a

    const enriched = (posts || []).map(p => ({
        ...p,
        author_name: authorMap[p.user_id]?.name || 'Rainha',
        author_role: authorMap[p.user_id]?.role || 'patient',
        reaction_count: (p as any).community_reactions?.[0]?.count || 0,
    }))

    return NextResponse.json({ posts: enriched })
}

// POST: admin posts announcement or pins a post
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()

    if (body.action === 'pin') {
        // Toggle pin on a post
        const { data: post } = await supabase
            .from('community_posts')
            .select('is_pinned')
            .eq('id', body.post_id)
            .eq('tenant_id', tenant.id)
            .single()

        if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

        await supabase.from('community_posts')
            .update({ is_pinned: !post.is_pinned })
            .eq('id', body.post_id)

        return NextResponse.json({ pinned: !post.is_pinned })
    }

    if (body.action === 'delete') {
        await supabase.from('community_posts')
            .delete()
            .eq('id', body.post_id)
            .eq('tenant_id', tenant.id)
        return NextResponse.json({ deleted: true })
    }

    if (body.action === 'ocultar') {
        const { data: post } = await supabase
            .from('community_posts')
            .select('oculto')
            .eq('id', body.post_id)
            .eq('tenant_id', tenant.id)
            .single()
        if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
        await supabase.from('community_posts')
            .update({ oculto: !post.oculto })
            .eq('id', body.post_id)
        return NextResponse.json({ oculto: !post.oculto })
    }

    // Default: create system announcement
    const text = (body.body || '').trim()
    if (!text || text.length > 1000) {
        return NextResponse.json({ error: 'Texto inválido' }, { status: 400 })
    }

    const nivelMinimo = Number(body.nivel_minimo) || 1

    const { data: post, error } = await supabase
        .from('community_posts')
        .insert({
            tenant_id: tenant.id,
            user_id: user.id,
            type: body.type || 'system',
            body: text,
            meta: body.meta || {},
            is_pinned: body.is_pinned || false,
            nivel_minimo: nivelMinimo,
            oculto: false,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ post })
}
