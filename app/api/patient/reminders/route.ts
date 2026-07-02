// ROTA REMOVIDA — Fase 1 · Limpeza de código morto
//
// Esta rota gerenciava patient_reminders (tabela agora renomeada para
// _deprecated_patient_reminders). O sistema ativo de alarmes é patient_alarms,
// gerenciado pela rota /api/patient/alarms.
//
// Se precisar migrar dados de _deprecated_patient_reminders para patient_alarms,
// use o script supabase/migrations/20260702000001_cleanup_deprecated_tables.sql
// como referência e crie uma migration de migração de dados.
//
// Histórico: git show refactor/fase1-limpeza-codigo-morto:app/api/patient/reminders/route.ts

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Use /api/patient/alarms para gerenciar alarmes.' },
    { status: 410 }
  )
}

export async function POST() {
  return NextResponse.json(
    { error: 'Use /api/patient/alarms para gerenciar alarmes.' },
    { status: 410 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Use /api/patient/alarms para gerenciar alarmes.' },
    { status: 410 }
  )
}
