import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: comentarios, error } = await supabase
        .from('comentarios_comunidade')
        .select('id, post_id, corpo, oculto, criado_em, user_id')
        .eq('tenant_id', tenant.id)
        .order('criado_em', { ascending: false })
        .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const authorIds = Array.from(new Set((comentarios || []).map(c => c.user_id as string)))
    const { data: authors } = await supabase
        .from('profiles').select('user_id, name').in('user_id', authorIds)
    const authorMap: Record<string, string> = {}
    for (const a of authors || []) authorMap[a.user_id] = a.name

    const enriched = (comentarios || []).map(c => ({
        ...c,
        author_name: authorMap[c.user_id] || 'Rainha',
    }))

    return NextResponse.json({ comentarios: enriched })
}
