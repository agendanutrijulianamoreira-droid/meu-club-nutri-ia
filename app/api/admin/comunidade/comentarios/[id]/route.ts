import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PATCH(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: comentario } = await supabase
        .from('comentarios_comunidade')
        .select('oculto')
        .eq('id', params.id)
        .eq('tenant_id', tenant.id)
        .single()

    if (!comentario) return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 })

    const { error } = await supabase
        .from('comentarios_comunidade')
        .update({ oculto: !comentario.oculto })
        .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ oculto: !comentario.oculto })
}
