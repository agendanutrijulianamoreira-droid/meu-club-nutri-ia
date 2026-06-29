import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles').select('tenant_id').eq('user_id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: comentarios, error } = await supabase
        .from('comentarios_comunidade')
        .select('id, corpo, criado_em, user_id')
        .eq('post_id', params.id)
        .eq('tenant_id', profile.tenant_id)
        .eq('oculto', false)
        .order('criado_em', { ascending: true })
        .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const authorIds = Array.from(new Set((comentarios || []).map(c => c.user_id as string)))
    const { data: authors } = await supabase
        .from('profiles').select('user_id, name').in('user_id', authorIds)
    const authorMap: Record<string, string> = {}
    for (const a of authors || []) authorMap[a.user_id] = a.name

    const enriched = (comentarios || []).map(c => ({
        id: c.id,
        corpo: c.corpo,
        criado_em: c.criado_em,
        is_own: c.user_id === user.id,
        author_name: authorMap[c.user_id] || 'Rainha',
        author_initials: (authorMap[c.user_id] || 'R').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
    }))

    return NextResponse.json({ comentarios: enriched })
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles').select('tenant_id').eq('user_id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const corpo = (body.corpo || '').trim()
    if (!corpo || corpo.length > 500) {
        return NextResponse.json({ error: 'Comentário inválido (1-500 caracteres)' }, { status: 400 })
    }

    // Verify post belongs to tenant
    const { data: post } = await supabase
        .from('community_posts')
        .select('id, nivel_minimo')
        .eq('id', params.id)
        .eq('tenant_id', profile.tenant_id)
        .single()
    if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })

    const { data: nivelRow } = await supabase
        .from('nivel_paciente').select('nivel').eq('user_id', user.id).single()
    const patientNivel = nivelRow?.nivel ?? 1
    if ((post.nivel_minimo ?? 1) > patientNivel) {
        return NextResponse.json({ error: 'Acesso negado para este nível de conteúdo' }, { status: 403 })
    }

    const { data: comentario, error } = await supabase
        .from('comentarios_comunidade')
        .insert({
            post_id: params.id,
            tenant_id: profile.tenant_id,
            user_id: user.id,
            corpo,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ comentario })
}
