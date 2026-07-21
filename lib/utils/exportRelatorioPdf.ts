import { jsPDF } from "jspdf"

interface RelatorioDados {
  paciente: { nome: string; primary_goal?: string; fase_atual?: string | null }
  periodo: { inicio: string; fim: string; dias: number }
  adesao: { taxa_percentual: number; dias_com_registro: number; total_dias: number }
  sintomas: Record<string, number | null>
  peso_inicial?: number | null
  peso_atual?: number | null
}

const LABELS_SINTOMAS: Record<string, string> = {
  media_energia: "Energia",
  media_inchaco: "Inchaço",
  media_compulsao: "Compulsão",
  media_sono: "Qualidade do sono",
  media_ansiedade: "Ansiedade",
  media_dor_abdominal: "Dor abdominal",
  media_retencao_liquido: "Retenção de líquido",
  media_humor: "Humor",
}

export function exportRelatorioPdf({
  tenantName,
  dados,
  analiseClinica,
}: {
  tenantName?: string
  dados: RelatorioDados
  analiseClinica: string
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const marginX = 16
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = 18

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage()
      y = 18
    }
  }

  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text((tenantName || "VitaClub").toUpperCase(), marginX, y)
  y += 8

  doc.setFontSize(17)
  doc.setTextColor(20, 20, 20)
  doc.text("Relatório Pré-Consulta", marginX, y)
  y += 7

  doc.setFontSize(11)
  doc.setTextColor(60, 60, 60)
  doc.text(dados.paciente.nome, marginX, y)
  y += 5.5

  doc.setFontSize(9.5)
  doc.setTextColor(100, 100, 100)
  const meta = [
    dados.paciente.fase_atual ? `Fase atual: ${dados.paciente.fase_atual}` : null,
    dados.paciente.primary_goal ? `Objetivo: ${dados.paciente.primary_goal}` : null,
    `Período: ${dados.periodo.inicio} a ${dados.periodo.fim}`,
  ].filter(Boolean).join("   ·   ")
  doc.text(doc.splitTextToSize(meta, pageWidth - marginX * 2), marginX, y)
  y += 9

  doc.setDrawColor(220, 220, 220)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  // Indicadores
  doc.setFontSize(12)
  doc.setTextColor(40, 40, 40)
  doc.text("Indicadores do período", marginX, y)
  y += 6

  doc.setFontSize(9.5)
  doc.setTextColor(50, 50, 50)
  const indicadores = [
    `Adesão alimentar: ${dados.adesao.taxa_percentual}% (${dados.adesao.dias_com_registro}/${dados.adesao.total_dias} dias)`,
    dados.peso_inicial != null || dados.peso_atual != null
      ? `Peso: ${dados.peso_inicial ?? 'N/D'}kg → ${dados.peso_atual ?? 'N/D'}kg`
      : null,
    ...Object.entries(dados.sintomas)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${LABELS_SINTOMAS[k] || k}: ${v}/10`),
  ].filter(Boolean) as string[]

  for (const linha of indicadores) {
    ensureSpace(6)
    doc.text(`•  ${linha}`, marginX + 2, y)
    y += 5.5
  }
  y += 4

  doc.setDrawColor(220, 220, 220)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  // Análise clínica
  doc.setFontSize(12)
  doc.setTextColor(40, 40, 40)
  doc.text("Análise clínica (IA)", marginX, y)
  y += 7

  doc.setFontSize(9.5)
  doc.setTextColor(40, 40, 40)
  const linhas = analiseClinica.split("\n")
  for (const linha of linhas) {
    if (!linha.trim()) {
      y += 3
      continue
    }
    const wrapped = doc.splitTextToSize(linha, pageWidth - marginX * 2)
    ensureSpace(5 * wrapped.length)
    doc.text(wrapped, marginX, y)
    y += 5 * wrapped.length
  }

  const fileName = `relatorio-pre-consulta-${dados.paciente.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`
  doc.save(fileName)
}
