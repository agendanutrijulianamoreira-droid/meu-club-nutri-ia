// ROTA REMOVIDA — Fase 1 · Limpeza de código morto
//
// Esta rota de moderação (listagem + pin + delete de posts da comunidade)
// nunca teve uma view admin associada.
//
// A moderação do feed hoje acontece diretamente pelo
// runCommunityModerationAgent (supabase/functions/agent-orchestrator/index.ts)
// que é acionado pelo evento `post_created`.
//
// Se precisar de moderação manual no futuro, criar uma aba
// dentro do CommunicationCenterView (Fase 4 do plano de unificação).
//
// Histórico: git show refactor/fase1-limpeza-codigo-morto:app/api/admin/community/route.ts

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Rota descontinuada. Moderação de comunidade será via Centro de Comunicação.' },
    { status: 410 }
  )
}

export async function POST() {
  return NextResponse.json(
    { error: 'Rota descontinuada. Moderação de comunidade será via Centro de Comunicação.' },
    { status: 410 }
  )
}
