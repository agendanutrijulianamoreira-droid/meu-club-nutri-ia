import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Libera o protocolo sazonal para todas as assinantes do tenant.
// Pacientes que já têm um protocolo ativo são pulados (só é permitido 1 protocolo ativo por vez).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: protocol } = await supabase
    .from('protocols').select('id').eq('id', params.id).eq('tenant_id', tenant.id).single()
  if (!protocol) return NextResponse.json({ error: 'Protocolo não encontrado' }, { status: 404 })

  const { data: patients } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('tenant_id', tenant.id)
    .eq('role', 'patient')

  const { data: activeAssignments } = await supabase
    .from('protocol_assignments')
    .select('user_id')
    .eq('tenant_id', tenant.id)
    .eq('status', 'active')

  const busyUserIds = new Set((activeAssignments || []).map((a: any) => a.user_id))
  const eligible = (patients || []).filter((p: any) => !busyUserIds.has(p.user_id))

  if (eligible.length > 0) {
    const rows = eligible.map((p: any) => ({
      user_id: p.user_id,
      protocol_id: protocol.id,
      tenant_id: tenant.id,
      status: 'active',
    }))
    const { error } = await supabase.from('protocol_assignments').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('protocols').update({ is_active: true }).eq('id', protocol.id)

  return NextResponse.json({
    success: true,
    released: eligible.length,
    skipped: (patients?.length || 0) - eligible.length,
  })
}
