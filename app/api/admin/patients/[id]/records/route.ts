import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const RECORD_TYPES = ['encaminhamento', 'evolucao_clinica', 'exame', 'nota', 'observacao'] as const

// Prontuário clínico — visível SOMENTE para admin/nutritionist do próprio tenant.
// Nunca exposto a nenhuma rota do app da paciente.
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const patientId = params.id
    const { data: profile } = await supabase
        .from('profiles').select('tenant_id').eq('user_id', patientId).single()
    if (!profile || profile.tenant_id !== tenant.id) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const { data: records, error } = await supabase
        .from('patient_records')
        .select('id, type, title, body, attachment_path, tag_ids, created_at')
        .eq('tenant_id', tenant.id)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Gerar signed URL sob demanda para quem tem anexo — o bucket é privado
    // (sem policy nenhuma de storage.objects), então só o service role acessa.
    const admin = getSupabaseAdmin()
    const withUrls = await Promise.all((records || []).map(async r => {
        if (!r.attachment_path) return { ...r, attachment_url: null }
        const { data: signed } = await admin.storage
            .from('patient-records')
            .createSignedUrl(r.attachment_path, 60 * 10)
        return { ...r, attachment_url: signed?.signedUrl || null }
    }))

    return NextResponse.json({ records: withUrls })
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const patientId = params.id
    const { data: profile } = await supabase
        .from('profiles').select('tenant_id').eq('user_id', patientId).single()
    if (!profile || profile.tenant_id !== tenant.id) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const type = formData.get('type') as string
    const title = (formData.get('title') as string || '').trim()
    const body = (formData.get('body') as string) || null
    const tagIdsRaw = (formData.get('tag_ids') as string) || '[]'
    const file = formData.get('file') as File | null

    if (!title) return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 })
    if (!RECORD_TYPES.includes(type as typeof RECORD_TYPES[number])) {
        return NextResponse.json({ error: 'type inválido' }, { status: 400 })
    }

    let tagIds: string[] = []
    try {
        tagIds = JSON.parse(tagIdsRaw)
        if (!Array.isArray(tagIds)) tagIds = []
    } catch { tagIds = [] }

    let attachmentPath: string | null = null
    if (file && file.size > 0) {
        const admin = getSupabaseAdmin()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${tenant.id}/${patientId}/${Date.now()}_${safeName}`
        const bytes = Buffer.from(await file.arrayBuffer())

        const { data: uploadData, error: uploadError } = await admin.storage
            .from('patient-records')
            .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })

        if (uploadError) return NextResponse.json({ error: `Falha no upload: ${uploadError.message}` }, { status: 500 })
        attachmentPath = uploadData?.path || null
    }

    const { data: record, error } = await supabase
        .from('patient_records')
        .insert({
            tenant_id: tenant.id,
            patient_id: patientId,
            type,
            title,
            body,
            attachment_path: attachmentPath,
            tag_ids: tagIds,
            created_by: user.id,
        })
        .select('id, type, title, body, attachment_path, tag_ids, created_at')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let attachmentUrl: string | null = null
    if (attachmentPath) {
        const admin = getSupabaseAdmin()
        const { data: signed } = await admin.storage
            .from('patient-records')
            .createSignedUrl(attachmentPath, 60 * 10)
        attachmentUrl = signed?.signedUrl || null
    }

    return NextResponse.json({ record: { ...record, attachment_url: attachmentUrl } })
}
