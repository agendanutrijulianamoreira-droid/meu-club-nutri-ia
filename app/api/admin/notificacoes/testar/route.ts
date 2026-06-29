import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { enviarNotificacaoFase } from "@/lib/services/notificacoesService"
import { TipoNotificacao } from "@/lib/config/mensagensNotificacao"

// POST /api/admin/notificacoes/testar
// Body: { paciente_id, tipo }
// Busca fase atual + token FCM da paciente e dispara push de teste
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { paciente_id: string; tipo: TipoNotificacao }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { paciente_id, tipo } = body
  if (!paciente_id || !tipo) {
    return NextResponse.json({ error: 'paciente_id e tipo são obrigatórios' }, { status: 400 })
  }

  // Busca fase vigente
  const { data: faseRow } = await supabase
    .from('fase_paciente')
    .select('fase')
    .eq('paciente_id', paciente_id)
    .is('fim', null)
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!faseRow) {
    return NextResponse.json({ error: 'Paciente sem fase do REINO atribuída' }, { status: 422 })
  }

  // Busca token FCM da paciente
  const { data: tokenRow } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', paciente_id)
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tokenRow) {
    return NextResponse.json({ error: 'Paciente sem token push cadastrado' }, { status: 422 })
  }

  // Busca nome da paciente
  const { data: perfil } = await supabase
    .from('profiles')
    .select('name')
    .eq('user_id', paciente_id)
    .single()

  const resultado = await enviarNotificacaoFase({
    token: tokenRow.token,
    fase: faseRow.fase,
    tipo,
    nomePaciente: perfil?.name?.split(' ')[0],
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.erro }, { status: 500 })
  }

  return NextResponse.json({ ok: true, mensagem: 'Push enviado com sucesso' })
}
