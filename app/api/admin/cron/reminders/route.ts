// ROTA REMOVIDA — Fase 1 · Limpeza de código morto
//
// Esta rota de cron disparava lembretes via patient_reminders,
// tabela que foi renomeada para _deprecated_patient_reminders.
//
// O sistema ativo de alarmes usa patient_alarms + /api/cron/dispatch-alarms.
// Não registrar esta rota em vercel.json — ela nunca estava registrada.
//
// Histórico: git show refactor/fase1-limpeza-codigo-morto:app/api/admin/cron/reminders/route.ts

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Cron de lembretes descontinuado.',
      message: 'Use /api/cron/dispatch-alarms para alarmes ativos (patient_alarms).',
    },
    { status: 410 }
  )
}
