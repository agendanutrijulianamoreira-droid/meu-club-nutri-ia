import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Rota pública (sem auth) — captura de lead na página de venda avulsa.
// O fechamento da venda (pix/link) é feito manualmente pela nutricionista via WhatsApp.
export async function POST(request: NextRequest) {
  const { protocolId, name, whatsapp, email } = await request.json()

  if (!protocolId || !name?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }
  if (!whatsapp?.trim() && !email?.trim()) {
    return NextResponse.json({ error: 'Informe WhatsApp ou e-mail para contato' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: protocol } = await admin
    .from('protocols')
    .select('id, tenant_id, is_standalone')
    .eq('id', protocolId)
    .eq('is_standalone', true)
    .single()

  if (!protocol) return NextResponse.json({ error: 'Protocolo não disponível' }, { status: 404 })

  const { error } = await admin.from('protocol_leads').insert({
    tenant_id: protocol.tenant_id,
    protocol_id: protocol.id,
    name: name.trim(),
    whatsapp: whatsapp?.trim() || null,
    email: email?.trim() || null,
  })

  if (error) return NextResponse.json({ error: 'Erro ao registrar interesse' }, { status: 500 })
  return NextResponse.json({ success: true })
}
