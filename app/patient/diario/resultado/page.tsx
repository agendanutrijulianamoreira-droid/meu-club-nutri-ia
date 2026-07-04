"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { X, Loader2, Sparkles } from "lucide-react"

const CAPTURA_STORAGE_KEY = "diarioFotoCaptura"

interface AlimentoFoto {
  nome: string
  porcao_g: number
  calorias: number
  proteina_g?: number
  carbo_g?: number
  gordura_g?: number
  confianca: "alta" | "media" | "baixa"
}

interface CapturaResultado {
  foto_base64: string
  alimentos: AlimentoFoto[]
  insights: string[]
}

interface MetaDiaria {
  calorias_meta: number
  proteina_meta_g: number
  carboidrato_meta_g: number
  lipideos_meta_g: number
}

function MacroBar({ label, gramas, meta, colorClass }: { label: string; gramas: number; meta: number | undefined; colorClass: string }) {
  const percentual = meta ? Math.min(100, Math.round((gramas / meta) * 100)) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-stone-500 text-xs font-medium">{label}</span>
        <span className="text-stone-800 text-xs font-semibold">{Math.round(gramas)}g</span>
      </div>
      <div className="h-1 rounded-full bg-stone-100 overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percentual}%` }} />
      </div>
    </div>
  )
}

function ResultadoAnaliseInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refeicao = searchParams.get("refeicao") || "almoco"

  const [resultado, setResultado] = useState<CapturaResultado | null>(null)
  const [metaHoje, setMetaHoje] = useState<MetaDiaria | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(CAPTURA_STORAGE_KEY)
    if (!raw) {
      router.replace(`/patient/diario/adicionar?refeicao=${refeicao}`)
      return
    }
    try {
      setResultado(JSON.parse(raw))
    } catch {
      router.replace(`/patient/diario/adicionar?refeicao=${refeicao}`)
    }
  }, [router, refeicao])

  useEffect(() => {
    fetch("/api/patient/diario/meta")
      .then(r => r.json())
      .then(d => setMetaHoje(d.meta ?? null))
      .catch(() => setMetaHoje(null))
  }, [])

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  if (!resultado) return null

  const totalProt = resultado.alimentos.reduce((s, a) => s + (a.proteina_g || 0), 0)
  const totalCarbo = resultado.alimentos.reduce((s, a) => s + (a.carbo_g || 0), 0)
  const totalGordura = resultado.alimentos.reduce((s, a) => s + (a.gordura_g || 0), 0)

  const registrar = async () => {
    setSalvando(true)
    try {
      for (const alimento of resultado.alimentos) {
        await fetch("/api/patient/diario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      sessionStorage.removeItem(CAPTURA_STORAGE_KEY)
      showToast("success", "Refeição registrada!")
      setTimeout(() => router.push("/patient/diario"), 800)
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Erro ao registrar refeição")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-sand-50 pb-10">
      <div className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))] space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl text-stone-800">Análise Concluída</h1>
          <button
            onClick={() => router.push("/patient/diario")}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`px-4 py-3 rounded-2xl text-sm font-medium border ${
                toast.type === "success"
                  ? "bg-sage-50 border-sage-200 text-sage-700"
                  : "bg-terracotta-50 border-terracotta-200 text-terracotta-700"
              }`}
            >
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Foto */}
        <div className="rounded-3xl overflow-hidden aspect-[4/3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultado.foto_base64} alt="Foto da refeição" className="w-full h-full object-cover" />
        </div>

        {/* Macronutrientes */}
        <div className="space-y-4">
          <MacroBar label="Proteína" gramas={totalProt} meta={metaHoje?.proteina_meta_g} colorClass="bg-sage-600" />
          <MacroBar label="Carboidratos" gramas={totalCarbo} meta={metaHoje?.carboidrato_meta_g} colorClass="bg-terracotta-400" />
          <MacroBar label="Gorduras" gramas={totalGordura} meta={metaHoje?.lipideos_meta_g} colorClass="bg-sand-600" />
        </div>

        {/* Insights Inteligentes */}
        {resultado.insights.length > 0 && (
          <div className="bg-white rounded-3xl shadow-soft p-5 space-y-3">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sage-600">
              <Sparkles size={12} strokeWidth={1.5} />
              Insights Inteligentes
            </p>
            <div className="space-y-2.5">
              {resultado.insights.map((insight, i) => (
                <p key={i} className="text-stone-600 text-sm leading-relaxed">{insight}</p>
              ))}
            </div>
          </div>
        )}

        {/* Ação principal */}
        <button
          onClick={registrar}
          disabled={salvando}
          className="w-full flex items-center justify-center gap-2 py-4 bg-sage-600 hover:bg-sage-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
        >
          {salvando && <Loader2 size={16} className="animate-spin" />}
          {salvando ? "Registrando..." : "Registrar Refeição"}
        </button>
      </div>
    </div>
  )
}

export default function ResultadoAnalisePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-sand-50" />}>
      <ResultadoAnaliseInner />
    </Suspense>
  )
}
