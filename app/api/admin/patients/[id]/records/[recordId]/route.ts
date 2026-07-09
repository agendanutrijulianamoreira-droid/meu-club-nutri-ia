import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const RECORD_TYPES = ['encaminhamento', 'evolucao_clinica', 'exame', 'nota', 'observacao'] as const

async function loadOwnedRecord(
    supabase: ReturnType<typeof createSupabaseServerClient>,
    tenantId: string,
    patientId: string,
    recordId: string
) {
    const { data: record } = await supabase
        .from('patient_records')
        .select('id, tenant_id, patient_id, attachment_path')
        .eq('id', recordId)
        .single()
    if (!record || record.tenant_id !== tenantId || record.patient_id !== patientId) return null
    return record
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string; recordId: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const record = await loadOwnedRecord(supabase, tenant.id, params.id, params.recordId)
    if (!record) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim()
    if (typeof body.body === 'string' || body.body === null) updates.body = body.body
    if (body.type && RECORD_TYPES.includes(body.type)) updates.type = body.type
    if (Array.isArray(body.tag_ids)) updates.tag_ids = body.tag_ids

    if (Object.keys(updates).length === 0) return NextResponse.json({ success: true })

    const { error } = await supabase
        .from('patient_records')
        .update(updates)
        .eq('id', params.recordId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string; recordId: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const record = await loadOwnedRecord(supabase, tenant.id, params.id, params.recordId)
    if (!record) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })

    const { error } = await supabase
        .from('patient_records')
        .delete()
        .eq('id', params.recordId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (record.attachment_path) {
        const admin = getSupabaseAdmin()
        await admin.storage.from('patient-records').remove([record.attachment_path]).catch(() => {})
    }

    return NextResponse.json({ success: true })
}
