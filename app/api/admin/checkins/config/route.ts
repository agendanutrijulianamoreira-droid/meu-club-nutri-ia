// ROTA REMOVIDA — Fase 1 · Limpeza de código morto
//
// A tela de Check-ins usa as rotas irmãs (GET/POST /api/admin/checkins)
// para listar e criar check-ins — nunca chamou esta rota de configuração.
//
// A configuração de check-in (frequência, dia, hora, nota) fica em
// tenants.settings.checkin_config e pode ser editada diretamente via
// Settings (admin/views/SettingsView.tsx).
//
// Histórico: git show refactor/fase1-limpeza-codigo-morto:app/api/admin/checkins/config/route.ts

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Rota descontinuada. Configure check-ins em Configurações.' },
    { status: 410 }
  )
}

export async function POST() {
  return NextResponse.json(
    { error: 'Rota descontinuada. Configure check-ins em Configurações.' },
    { status: 410 }
  )
}
