// ROTA REMOVIDA — Fase 1 · Limpeza de código morto
//
// Esta rota nunca foi chamada por nenhuma view admin.
// O envio de push por segmento acontece dentro do agent-orchestrator
// via runDailyEngagementAgent / runRetentionAgent.
//
// Se precisar reativar no futuro, o histórico está no git:
//   git show refactor/fase1-limpeza-codigo-morto:app/api/admin/push/route.ts
//
// Para enviar push manualmente, use o agente via:
//   POST /api/trigger-agent  { type: "manual", payload: { agent: "daily_engagement" } }

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Rota descontinuada.',
      message:
        'O envio de push em massa é feito pelo agent-orchestrator. ' +
        'Consulte o Centro de Comunicação para campanhas manuais.',
    },
    { status: 410 }
  )
}
