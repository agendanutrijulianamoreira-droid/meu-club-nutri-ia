export const dynamic = 'force-dynamic'

// ROTA REMOVIDA — Fase 1 · Limpeza de código morto
//
// O export CSV de pacientes está completo e funcional, mas nenhum botão
// em nenhuma view chama este endpoint.
//
// Para reativar: adicionar botão "Exportar CSV" em PatientsView.tsx
// apontando para GET /api/admin/export/patients
//
// Histórico: git show refactor/fase1-limpeza-codigo-morto:app/api/admin/export/patients/route.ts

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      error: 'Rota descontinuada temporariamente.',
      message:
        'O export CSV estará disponível assim que o botão de export for adicionado à tela de Pacientes.',
    },
    { status: 410 }
  )
}
