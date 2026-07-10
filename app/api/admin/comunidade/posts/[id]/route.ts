import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// PATCH /api/admin/comunidade/posts/[id] — atualizar post (ocultar/fixar/nivel)
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: post } = await supabase
        .from('community_posts')
        .select('id, is_pinned, oculto')
        .eq('id', params.id)
        .eq('tenant_id', tenant.id)
        .single()

    if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (typeof body.is_pinned === 'boolean') updates.is_pinned = body.is_pinned
    if (typeof body.oculto === 'boolean') updates.oculto = body.oculto
    if (typeof body.nivel_minimo === 'number') updates.nivel_minimo = body.nivel_minimo

    // Se não passou campos, faz toggle de is_pinned por compatibilidade
    if (Object.keys(updates).length === 0) {
        updates.is_pinned = !post.is_pinned
    }

    const { error } = await supabase
        .from('community_posts')
        .update(updates)
        .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, ...updates })
}

// DELETE /api/admin/comunidade/posts/[id] — remover post
export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', params.id)
        .eq('tenant_id', tenant.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
