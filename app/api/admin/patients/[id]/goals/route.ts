import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/admin/patients/[id]/goals — metas atribuídas à paciente (todas,
// não só as ativas, pra permitir revisar histórico de abandonadas/concluídas
// no futuro; a UI hoje só usa as ativas para decidir o que oferecer atribuir).
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

    const { data: assignments, error } = await supabase
        .from('patient_goal_assignments')
        .select('id, goal_id, title, description, emoji, goal_type, target_value, unit, deadline, current_value, status, created_at')
        .eq('tenant_id', tenant.id)
        .eq('user_id', patientId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ assignments: assignments || [] })
}
