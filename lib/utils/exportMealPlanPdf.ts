import { jsPDF } from "jspdf"

const MEAL_TYPES_PT: Record<string, string> = {
  cafe_manha: "Café da Manhã",
  lanche_manha: "Lanche da Manhã",
  almoco: "Almoço",
  lanche_tarde: "Lanche da Tarde",
  jantar: "Jantar",
  ceia: "Ceia",
  shot: "Shot",
}

interface MealItem {
  food_name: string
  quantity_g?: number
  quantity_description?: string
  calories?: number
  protein_g?: number
}

interface ExportMealPlanParams {
  title: string
  tenantName?: string
  patientName?: string
  totalCalories?: number
  durationDays?: number
  days: Record<string, Record<string, MealItem[]>>
}

export function exportMealPlanPdf({
  title,
  tenantName,
  patientName,
  totalCalories,
  durationDays,
  days,
}: ExportMealPlanParams) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const marginX = 16
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 18

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage()
      y = 18
    }
  }

  // Cabeçalho com branding
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text((tenantName || "VitaClub").toUpperCase(), marginX, y)
  y += 8

  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text(title, marginX, y)
  y += 8

  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  const infoLine = [
    patientName ? `Paciente: ${patientName}` : null,
    totalCalories ? `${totalCalories} kcal/dia` : null,
    durationDays ? `${durationDays} dias` : null,
  ].filter(Boolean).join("   ·   ")
  if (infoLine) {
    doc.text(infoLine, marginX, y)
    y += 6
  }

  doc.setDrawColor(220, 220, 220)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  const dayKeys = Object.keys(days).sort((a, b) => Number(a) - Number(b))

  for (const dayNum of dayKeys) {
    ensureSpace(12)
    doc.setFontSize(13)
    doc.setTextColor(40, 40, 40)
    doc.text(`Dia ${dayNum}`, marginX, y)
    y += 7

    const meals = days[dayNum]
    for (const [mealType, items] of Object.entries(meals)) {
      ensureSpace(10)
      doc.setFontSize(10.5)
      doc.setTextColor(60, 60, 100)
      doc.text(MEAL_TYPES_PT[mealType] || mealType, marginX + 2, y)
      y += 5.5

      for (const item of items) {
        ensureSpace(6)
        doc.setFontSize(9.5)
        doc.setTextColor(30, 30, 30)
        const qty = item.quantity_description || (item.quantity_g ? `${item.quantity_g}g` : "")
        const cal = item.calories ? `${Math.round(item.calories)} kcal` : ""
        const line = [item.food_name, qty, cal].filter(Boolean).join("  —  ")
        const wrapped = doc.splitTextToSize(line, pageWidth - marginX * 2 - 6)
        doc.text(wrapped, marginX + 6, y)
        y += 5 * wrapped.length
      }
      y += 2
    }
    y += 4
  }

  const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`
  doc.save(fileName)
}
