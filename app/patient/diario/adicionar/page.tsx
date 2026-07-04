"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Check, ChevronDown, Loader2, ArrowLeft, Info, Camera } from "lucide-react"
import { usePlanGate } from "@/lib/hooks/usePlanGate"
import { PlanUpgradePrompt } from "@/components/patient/PlanUpgradePrompt"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alimento {
  id: string
  name: string
  category: string
  energy_kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  total_fat_g: number | null
  fiber_g: number | null
  serving_size_g: number | null
  serving_label: string | null
  vitamin_c_mg: number | null
  iron_mg: number | null
  calcium_mg: number | null
  potassium_mg: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REFEICOES = [
  { key: 'cafe_manha', label: 'Café da Manhã' },
  { key: 'almoco',     label: 'Almoço' },
  { key: 'lanche',     label: 'Lanche' },
  { key: 'jantar',     label: 'Jantar' },
  { key: 'ceia',       label: 'Ceia' },
]

// Ingestão Diária Recomendada (ANVISA RDC 269/2005), usada só para o % exibido
const IDR_MG = { vitamina_c: 45, ferro: 14, calcio: 1000, potassio: 3500 }

function calcMacro(valorPer100g: number | null, gramas: number): number | null {
  if (valorPer100g == null) return null
  return Math.round((valorPer100g * gramas) / 100 * 10) / 10
}

// ─── Inner Component (uses useSearchParams) ───────────────────────────────────

function AdicionarAlimentoInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refeicaoParam = searchParams.get('refeicao') || 'almoco'
  const { allowed: podeUsarFotoIA, loading: loadingPlanGate } = usePlanGate('plate_analysis_ai')

  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Alimento[]>([])
  const [buscando, setBuscando] = useState(false)
  const [selecionado, setSelecionado] = useState<Alimento | null>(null)
  const [quantidade, setQuantidade] = useState('')
  const [refeicao, setRefeicao] = useState(refeicaoParam)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showRefeicaoSelect, setShowRefeicaoSelect] = useState(false)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Busca com debounce
  useEffect(() => {
    if (query.length < 2) {
      setResultados([])
      return
    }
    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/patient/diario?q=${encodeURIComponent(query)}`)
        if (!res.ok) throw new Error('Erro na busca')
        const { alimentos } = await res.json()
        setResultados(alimentos ?? [])
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  const gramas = parseFloat(quantidade) || 0
  const kcalCalc = selecionado ? calcMacro(selecionado.energy_kcal, gramas) : null
  const protCalc = selecionado ? calcMacro(selecionado.protein_g, gramas) : null
  const carboCalc = selecionado ? calcMacro(selecionado.carbs_g, gramas) : null
  const gordCalc = selecionado ? calcMacro(selecionado.total_fat_g, gramas) : null
  const fibraCalc = selecionado ? calcMacro(selecionado.fiber_g, gramas) : null
  const vitCCalc = selecionado ? calcMacro(selecionado.vitamin_c_mg, gramas) : null
  const ferroCalc = selecionado ? calcMacro(selecionado.iron_mg, gramas) : null
  const calcioCalc = selecionado ? calcMacro(selecionado.calcium_mg, gramas) : null
  const potassioCalc = selecionado ? calcMacro(selecionado.potassium_mg, gramas) : null
  const temMicronutrientes = [vitCCalc, ferroCalc, calcioCalc, potassioCalc].some(v => v != null)

  const handleSelecionarAlimento = (alimento: Alimento) => {
    setSelecionado(alimento)
    setResultados([])
    setQuery(alimento.name)
    // Preenche quantidade padrão com porção do alimento
    if (alimento.serving_size_g) {
      setQuantidade(String(alimento.serving_size_g))
    } else {
      setQuantidade('100')
    }
  }

  const handleSalvar = useCallback(async () => {
    if (!selecionado || !gramas || gramas <= 0) {
      showToast('error', 'Selecione um alimento e informe a quantidade')
      return
    }
    if (kcalCalc == null) {
      showToast('error', 'Alimento sem informação calórica')
      return
    }

    setSalvando(true)
    try {
      const res = await fetch('/api/patient/diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_refeicao: refeicao,
          food_id: selecionado.id,
          alimento_nome: selecionado.name,
          quantidade_gramas: gramas,
          calorias_calculadas: kcalCalc,
          proteina_calculada: protCalc,
          carboidrato_calculado: carboCalc,
          lipideos_calculado: gordCalc,
          fibra_calculada: fibraCalc,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao salvar')
      }
      showToast('success', 'Registrado!')
      setTimeout(() => router.push('/patient/diario'), 800)
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }, [selecionado, gramas, refeicao, kcalCalc, protCalc, carboCalc, gordCalc, fibraCalc, router])

  const refeicaoLabel = REFEICOES.find(r => r.key === refeicao)?.label ?? 'Refeição'

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Adicionar Alimento</h1>
          <p className="text-slate-500 text-xs">Base TACO/TBCA</p>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`px-4 py-3 rounded-2xl text-sm font-medium border ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seletor de refeição */}
      <div className="relative">
        <button
          onClick={() => setShowRefeicaoSelect(!showRefeicaoSelect)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white hover:bg-white/10 transition-colors"
        >
          <span className="font-medium">{refeicaoLabel}</span>
          <ChevronDown size={16} className="text-slate-400" />
        </button>
        <AnimatePresence>
          {showRefeicaoSelect && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden z-10"
            >
              {REFEICOES.map(r => (
                <button
                  key={r.key}
                  onClick={() => { setRefeicao(r.key); setShowRefeicaoSelect(false) }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/5 ${refeicao === r.key ? 'text-indigo-400 font-bold' : 'text-white'}`}
                >
                  {r.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botão fotografar (exclusivo plano VIP) — abre a tela de captura dedicada */}
      {!loadingPlanGate && (
        podeUsarFotoIA ? (
          <button
            onClick={() => router.push(`/patient/diario/capturar?refeicao=${refeicao}`)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 hover:border-indigo-500/30 rounded-2xl text-sm text-slate-300 transition-all"
          >
            <Camera size={16} className="text-indigo-400" />
            Fotografar refeição
          </button>
        ) : (
          <PlanUpgradePrompt
            feature="Avaliação de pratos por IA"
            benefit="Fotografe sua refeição e deixe a IA identificar os alimentos, porções e calorias automaticamente. Exclusivo do plano VIP."
            badgeLabel="Disponível no plano VIP"
          />
        )
      )}

      {/* Separador */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-slate-600 text-xs">ou buscar</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      {/* Campo de busca */}
      <div className="relative">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); if (selecionado) setSelecionado(null) }}
            placeholder="Buscar alimento... ex: arroz, frango, banana"
            className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResultados([]); setSelecionado(null) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Resultados da busca */}
        <AnimatePresence>
          {(resultados.length > 0 || buscando) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden z-10 max-h-60 overflow-y-auto"
            >
              {buscando ? (
                <div className="flex items-center gap-2 px-4 py-3 text-slate-500 text-sm">
                  <Loader2 size={14} className="animate-spin" />
                  Buscando...
                </div>
              ) : (
                resultados.map(alimento => (
                  <button
                    key={alimento.id}
                    onClick={() => handleSelecionarAlimento(alimento)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                  >
                    <p className="text-white text-sm font-medium">{alimento.name}</p>
                    <p className="text-slate-500 text-xs">
                      {alimento.category} · {alimento.energy_kcal ?? '?'} kcal/100g
                    </p>
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quantidade + preview nutricional (busca manual) */}
      <AnimatePresence>
        {selecionado && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Alimento selecionado */}
            <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-indigo-300 text-sm font-bold">{selecionado.name}</p>
                <p className="text-indigo-400/60 text-xs">{selecionado.category}</p>
              </div>
              <Check size={16} className="text-indigo-400" />
            </div>

            {/* Quantidade */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">
                Quantidade (gramas)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={quantidade}
                  onChange={e => setQuantidade(e.target.value)}
                  placeholder="100"
                  min="1"
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
                <span className="text-slate-500 text-sm">g</span>
              </div>
              {selecionado.serving_label && (
                <p className="text-slate-600 text-xs mt-1 flex items-center gap-1">
                  <Info size={11} />
                  Porção padrão: {selecionado.serving_label} ({selecionado.serving_size_g}g)
                </p>
              )}
            </div>

            {/* Preview nutricional */}
            {gramas > 0 && kcalCalc != null && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Preview para {gramas}g</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Calorias</span>
                    <span className="text-white font-bold">{kcalCalc} kcal</span>
                  </div>
                  {protCalc != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Proteína</span>
                      <span className="text-indigo-400 font-bold">{protCalc}g</span>
                    </div>
                  )}
                  {carboCalc != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Carbo</span>
                      <span className="text-amber-400 font-bold">{carboCalc}g</span>
                    </div>
                  )}
                  {gordCalc != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gordura</span>
                      <span className="text-rose-400 font-bold">{gordCalc}g</span>
                    </div>
                  )}
                  {fibraCalc != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fibra</span>
                      <span className="text-emerald-400 font-bold">{fibraCalc}g</span>
                    </div>
                  )}
                </div>

                {/* Micronutrientes (% da Ingestão Diária Recomendada) */}
                {temMicronutrientes && (
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Micronutrientes</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Vit. C', value: vitCCalc, idr: IDR_MG.vitamina_c },
                        { label: 'Ferro', value: ferroCalc, idr: IDR_MG.ferro },
                        { label: 'Cálcio', value: calcioCalc, idr: IDR_MG.calcio },
                        { label: 'Potássio', value: potassioCalc, idr: IDR_MG.potassio },
                      ].map(({ label, value, idr }) => (
                        <div key={label} className="text-center bg-white/5 rounded-xl px-2 py-2">
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
                          <p className="text-white text-xs font-bold mt-0.5">
                            {value != null ? `${Math.round((value / idr) * 100)}%` : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botão salvar */}
            <button
              onClick={handleSalvar}
              disabled={salvando || !gramas || gramas <= 0}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
            >
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {salvando ? 'Salvando...' : 'Registrar no diário'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dica inicial */}
      {!selecionado && query.length < 2 && (
        <div className="text-center py-8">
          <Search size={28} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Digite o nome de um alimento</p>
          <p className="text-slate-600 text-xs mt-1">Ex: arroz branco, peito de frango, banana prata</p>
        </div>
      )}
    </div>
  )
}

// ─── Page Wrapper ─────────────────────────────────────────────────────────────

export default function AdicionarAlimentoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    }>
      <AdicionarAlimentoInner />
    </Suspense>
  )
}
