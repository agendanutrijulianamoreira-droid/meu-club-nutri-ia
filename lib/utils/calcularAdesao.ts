export interface ResumoConsumo {
  calorias_consumidas: number
  calorias_meta: number
  percentual_calorias: number
  proteina_consumida: number
  proteina_meta: number
  percentual_proteina: number
  carboidrato_consumido: number
  carboidrato_meta: number
  lipideos_consumido: number
  lipideos_meta: number
  fibra_consumida: number
  fibra_meta: number
  status: 'abaixo' | 'adequado' | 'acima'
}

export interface RegistroDiario {
  calorias_calculadas: number
  proteina_calculada?: number | null
  carboidrato_calculado?: number | null
  lipideos_calculado?: number | null
  fibra_calculada?: number | null
}

export interface MetaPaciente {
  calorias_meta: number
  proteina_meta_g: number
  carboidrato_meta_g: number
  lipideos_meta_g: number
  fibra_meta_g: number
}

export function calcularAdesao(registros: RegistroDiario[], meta: MetaPaciente): ResumoConsumo {
  const totalCalorias = registros.reduce((acc, r) => acc + (r.calorias_calculadas || 0), 0)
  const totalProteina = registros.reduce((acc, r) => acc + (r.proteina_calculada || 0), 0)
  const totalCarbo = registros.reduce((acc, r) => acc + (r.carboidrato_calculado || 0), 0)
  const totalGordura = registros.reduce((acc, r) => acc + (r.lipideos_calculado || 0), 0)
  const totalFibra = registros.reduce((acc, r) => acc + (r.fibra_calculada || 0), 0)

  const pctCalorias = meta.calorias_meta > 0 ? (totalCalorias / meta.calorias_meta) * 100 : 0

  return {
    calorias_consumidas: Math.round(totalCalorias),
    calorias_meta: meta.calorias_meta,
    percentual_calorias: Math.round(pctCalorias),
    proteina_consumida: Math.round(totalProteina),
    proteina_meta: meta.proteina_meta_g,
    percentual_proteina: meta.proteina_meta_g > 0
      ? Math.round((totalProteina / meta.proteina_meta_g) * 100)
      : 0,
    carboidrato_consumido: Math.round(totalCarbo),
    carboidrato_meta: meta.carboidrato_meta_g,
    lipideos_consumido: Math.round(totalGordura),
    lipideos_meta: meta.lipideos_meta_g,
    fibra_consumida: Math.round(totalFibra * 10) / 10,
    fibra_meta: meta.fibra_meta_g,
    status: pctCalorias < 85 ? 'abaixo' : pctCalorias > 115 ? 'acima' : 'adequado',
  }
}
