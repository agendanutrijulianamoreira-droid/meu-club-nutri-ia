"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, X, Check, ChevronDown, Loader2, ArrowLeft, Info,
  Camera, AlertCircle, Minus, Plus,
} from "lucide-react"

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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REFEICOES = [
  { key: 'cafe_manha', label: 'Café da Manhã' },
  { key: 'almoco',     label: 'Almoço' },
  { key: 'lanche',     label: 'Lanche' },
  { key: 'jantar',     label: 'Jantar' },
  { key: 'ceia',       label: 'Ceia' },
]

function calcMacro(valorPer100g: number | null, gramas: number): number | null {
  if (valorPer100g == null) return null
  return Math.round((valorPer100g * gramas) / 100 * 10) / 10
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlimentoFoto {
  nome: string
  porcao_g: number
  calorias: number
  proteina_g?: number
  carbo_g?: number
  gordura_g?: number
  confianca: 'alta' | 'media' | 'baixa'
  selecionado: boolean
}

// ─── Inner Component (uses useSearchParams) ───────────────────────────────────

function AdicionarAlimentoInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refeicaoParam = searchParams.get('refeicao') || 'almoco'

  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Alimento[]>([])
  const [buscando, setBuscando] = useState(false)
  const [selecionado, setSelecionado] = useState<Alimento | null>(null)
  const [quantidade, setQuantidade] = useState('')
  const [refeicao, setRefeicao] = useState(refeicaoParam)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showRefeicaoSelect, setShowRefeicaoSelect] = useState(false)

  // Foto
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [analisandoFoto, setAnalisandoFoto] = useState(false)
  const [alimentosFoto, setAlimentosFoto] = useState<AlimentoFoto[] | null>(null)
  const [salvandoFoto, setSalvandoFoto] = useState(false)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // ─── Foto handlers ────────────────────────────────────────────────────────

  const handleFotoSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAnalisandoFoto(true)
    setAlimentosFoto(null)

    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/patient/foto-refeicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64 }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao analisar foto')
      }
      const { alimentos } = await res.json()
      if (!alimentos || alimentos.length === 0) {
        showToast('error', 'Nenhum alimento identificado na foto')
        return
      }
      setAlimentosFoto(alimentos.map((a: Omit<AlimentoFoto, 'selecionado'>) => ({ ...a, selecionado: true })))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao analisar foto')
    } finally {
      setAnalisandoFoto(false)
      // Reset input para permitir re-upload da mesma foto
      if (fotoInputRef.current) fotoInputRef.current.value = ''
    }
  }

  const handleSalvarFoto = async () => {
    if (!alimentosFoto) return
    const selecionados = alimentosFoto.filter(a => a.selecionado)
    if (selecionados.length === 0) {
      showToast('error', 'Selecione ao menos um alimento')
      return
    }

    setSalvandoFoto(true)
    try {
      for (const alimento of selecionados) {
        await fetch('/api/patient/diario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome_refeicao: refeicao,
            food_id: null,
            alimento_nome: alimento.nome,
            quantidade_gramas: alimento.porcao_g,
            calorias_calculadas: alimento.calorias,
            proteina_calculada: alimento.proteina_g ?? null,
            carboidrato_calculado: alimento.carbo_g ?? null,
            lipideos_calculado: alimento.gordura_g ?? null,
            fibra_calculada: null,
          }),
        })
      }
      showToast('success', `${selecionados.length} alimento(s) registrado(s)!`)
      setTimeout(() => router.push('/patient/diario'), 800)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvandoFoto(false)
    }
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

      {/* Input hidden para captura de foto */}
      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFotoSelecionada}
      />

      {/* Botão fotografar */}
      {!alimentosFoto && (
        <button
          onClick={() => fotoInputRef.current?.click()}
          disabled={analisandoFoto}
          className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 hover:border-indigo-500/30 rounded-2xl text-sm text-slate-300 transition-all disabled:opacity-50"
        >
          {analisandoFoto ? (
            <>
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              <span className="text-indigo-400">Analisando foto...</span>
            </>
          ) : (
            <>
              <Camera size={16} className="text-indigo-400" />
              Fotografar refeição
            </>
          )}
        </button>
      )}

      {/* Tela de confirmação dos alimentos identificados */}
      <AnimatePresence mode="wait">
        {alimentosFoto && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Alimentos identificados
              </p>
              <button
                onClick={() => setAlimentosFoto(null)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {alimentosFoto.map((alimento, idx) => (
              <div
                key={idx}
                className={`bg-white/5 border rounded-2xl p-3 transition-all ${
                  alimento.selecionado ? 'border-indigo-500/40' : 'border-white/5 opacity-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setAlimentosFoto(prev => prev!.map((a, i) =>
                      i === idx ? { ...a, selecionado: !a.selecionado } : a
                    ))}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                      alimento.selecionado ? 'bg-indigo-600 border-indigo-600' : 'border-white/20'
                    }`}
                  >
                    {alimento.selecionado && <Check size={11} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white text-sm font-medium truncate">{alimento.nome}</p>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        alimento.confianca === 'alta'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : alimento.confianca === 'media'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                      }`}>
                        {alimento.confianca}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Ajuste de porção */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAlimentosFoto(prev => prev!.map((a, i) =>
                            i === idx ? { ...a, porcao_g: Math.max(10, a.porcao_g - 10), calorias: Math.round((a.calorias / a.porcao_g) * Math.max(10, a.porcao_g - 10)) } : a
                          ))}
                          className="w-5 h-5 bg-white/10 hover:bg-white/20 rounded-md flex items-center justify-center"
                        >
                          <Minus size={10} className="text-slate-400" />
                        </button>
                        <span className="text-slate-300 text-xs w-12 text-center">{alimento.porcao_g}g</span>
                        <button
                          onClick={() => setAlimentosFoto(prev => prev!.map((a, i) =>
                            i === idx ? { ...a, porcao_g: a.porcao_g + 10, calorias: Math.round((a.calorias / a.porcao_g) * (a.porcao_g + 10)) } : a
                          ))}
                          className="w-5 h-5 bg-white/10 hover:bg-white/20 rounded-md flex items-center justify-center"
                        >
                          <Plus size={10} className="text-slate-400" />
                        </button>
                      </div>
                      <span className="text-slate-500 text-xs">{alimento.calorias} kcal</span>
                      {alimento.proteina_g != null && (
                        <span className="text-indigo-400/70 text-xs">{alimento.proteina_g}g prot</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Aviso confiança baixa */}
            {alimentosFoto.some(a => a.confianca === 'baixa') && (
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-400/80 text-xs">Alguns alimentos tiveram confiança baixa. Confira as porções antes de salvar.</p>
              </div>
            )}

            <button
              onClick={handleSalvarFoto}
              disabled={salvandoFoto || alimentosFoto.every(a => !a.selecionado)}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
            >
              {salvandoFoto ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {salvandoFoto ? 'Salvando...' : `Registrar ${alimentosFoto.filter(a => a.selecionado).length} alimento(s)`}
            </button>

            <button
              onClick={() => setAlimentosFoto(null)}
              className="w-full text-center text-slate-500 text-xs py-1"
            >
              Buscar manualmente
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Separador */}
      {!alimentosFoto && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-slate-600 text-xs">ou buscar</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>
      )}

      {/* Campo de busca */}
      {!alimentosFoto && (
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
      )} {/* end {!alimentosFoto && search} */}

      {/* Quantidade + preview nutricional (busca manual) */}
      <AnimatePresence>
        {selecionado && !alimentosFoto && (
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
      {!selecionado && !alimentosFoto && query.length < 2 && (
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
