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

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Verify patient belongs to this tenant
    const { data: profile } = await supabase
        .from('profiles').select('user_id').eq('user_id', params.id).eq('tenant_id', tenant.id).single()
    if (!profile) return NextResponse.json({ error: 'Paciente não encontrada' }, { status: 404 })

    const { data: nivelRow } = await supabase
        .from('nivel_paciente').select('nivel, validade').eq('user_id', params.id).single()

    return NextResponse.json({ nivel: nivelRow?.nivel ?? 1, validade: nivelRow?.validade ?? null })
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: profile } = await supabase
        .from('profiles').select('user_id').eq('user_id', params.id).eq('tenant_id', tenant.id).single()
    if (!profile) return NextResponse.json({ error: 'Paciente não encontrada' }, { status: 404 })

    const body = await request.json()
    const nivel = Number(body.nivel)
    if (!nivel || nivel < 1 || nivel > 4) {
        return NextResponse.json({ error: 'Nível inválido (1-4)' }, { status: 400 })
    }

    const { error } = await supabase
        .from('nivel_paciente')
        .upsert({
            user_id: params.id,
            tenant_id: tenant.id,
            nivel,
            validade: body.validade || null,
            atualizado_em: new Date().toISOString(),
        }, { onConflict: 'user_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ nivel, validade: body.validade || null })
}
