"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Utensils, Plus, Trash2, ChevronDown, ChevronUp,
  Drumstick, Leaf, Droplet, Loader2,
} from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase-browser"
import { goalForWeight } from "@/lib/hydration"
import { ProgressRing } from "@/components/patient/ProgressRing"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Registro {
  id: string
  nome_refeicao: string
  alimento_nome: string
  quantidade_gramas: number
  calorias_calculadas: number
  proteina_calculada: number | null
  carboidrato_calculado: number | null
  lipideos_calculado: number | null
  fibra_calculada: number | null
  created_at: string
}

interface Resumo {
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

// ─── Constants ────────────────────────────────────────────────────────────────

const REFEICOES: { key: string; label: string; emoji: string }[] = [
  { key: 'cafe_manha', label: 'Café da Manhã', emoji: '☀️' },
  { key: 'almoco',     label: 'Almoço',        emoji: '🍽️' },
  { key: 'lanche',     label: 'Lanche',         emoji: '🥗' },
  { key: 'jantar',     label: 'Jantar',          emoji: '🌙' },
  { key: 'ceia',       label: 'Ceia',            emoji: '🫖' },
]

// Linguagem acolhedora em vez de "meta batida/estourada" — o objetivo é dar
// clareza, não gerar ansiedade em torno do número de calorias
const ENERGIA_META = {
  abaixo:   { label: 'Ainda há espaço hoje', color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200/60' },
  adequado: { label: 'Nutrição equilibrada',  color: 'text-sage-700', bg: 'bg-sage-50 border-sage-200/60' },
  acima:    { label: 'Acima do habitual',    color: 'text-clay-600',  bg: 'bg-clay-50 border-clay-200/60' },
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DiarioAlimentarPage() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [waterMl, setWaterMl] = useState(0)
  const [waterGoalMl, setWaterGoalMl] = useState(2000)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedRefeicao, setExpandedRefeicao] = useState<string | null>('cafe_manha')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const hoje = todayStr()

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const [regRes, metaRes] = await Promise.all([
        fetch(`/api/patient/diario?data=${hoje}`),
        fetch(`/api/patient/diario/meta?data=${hoje}`),
      ])

      if (!regRes.ok || !metaRes.ok) throw new Error('Erro ao carregar dados')

      const { registros: regs } = await regRes.json()
      const { resumo: res } = await metaRes.json()

      setRegistros(regs ?? [])
      setResumo(res)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const [{ data: profile }, { data: log }] = await Promise.all([
          supabase.from('profiles').select('current_weight').eq('user_id', user.id).single(),
          supabase.from('daily_logs').select('water_ml').eq('user_id', user.id).eq('log_date', hoje).single(),
        ])
        setWaterGoalMl(goalForWeight(profile?.current_weight ?? null))
        setWaterMl(log?.water_ml ?? 0)
      }
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao carregar diário')
    } finally {
      setLoading(false)
    }
  }, [hoje])

  useEffect(() => { carregarDados() }, [carregarDados])

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este alimento do diário?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/patient/diario?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao remover')
      setRegistros(prev => prev.filter(r => r.id !== id))
      // Recarrega resumo
      const metaRes = await fetch(`/api/patient/diario/meta?data=${hoje}`)
      if (metaRes.ok) {
        const { resumo: res } = await metaRes.json()
        setResumo(res)
      }
      showToast('success', 'Removido!')
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao remover')
    } finally {
      setDeletingId(null)
    }
  }

  const caloriasRefeicao = (key: string) =>
    registros
      .filter(r => r.nome_refeicao === key)
      .reduce((acc, r) => acc + r.calorias_calculadas, 0)

  const energiaMeta = resumo ? ENERGIA_META[resumo.status] : null

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-800">
            Diário <span className="font-semibold">Alimentar</span>
          </h1>
          <p className="text-stone-500 text-xs mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          href="/patient/diario/adicionar"
          className="flex items-center gap-1.5 px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-2xl transition-all"
        >
          <Plus size={16} />
          Adicionar
        </Link>
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
                ? 'bg-sage-50 border-sage-200/70 text-sage-700'
                : 'bg-rose-50 border-rose-200/70 text-rose-600'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-sage-500" />
        </div>
      ) : (
        <>
          {/* Seu Nível de Energia Hoje — anéis de nutrição em vez de velocímetro de calorias */}
          {resumo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-[2rem] p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-stone-800 text-base font-medium">Seu Nível de Energia Hoje</p>
                {energiaMeta && (
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${energiaMeta.bg} ${energiaMeta.color}`}>
                    {energiaMeta.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center gap-1.5">
                  <ProgressRing
                    value={resumo.proteina_consumida} max={resumo.proteina_meta || 1}
                    size={64} strokeWidth={5} color="#79915d" trackColor="rgba(52,63,42,0.08)"
                  >
                    <Drumstick size={13} className="text-sage-600 mb-0.5" />
                    <span className="text-stone-800 text-xs font-bold leading-none">{Math.round(resumo.proteina_consumida)}g</span>
                  </ProgressRing>
                  <span className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">Proteína</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <ProgressRing
                    value={resumo.fibra_consumida} max={resumo.fibra_meta || 1}
                    size={64} strokeWidth={5} color="#c97a46" trackColor="rgba(52,63,42,0.08)"
                  >
                    <Leaf size={13} className="text-clay-500 mb-0.5" />
                    <span className="text-stone-800 text-xs font-bold leading-none">{Math.round(resumo.fibra_consumida)}g</span>
                  </ProgressRing>
                  <span className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">Fibras</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <ProgressRing
                    value={waterMl} max={waterGoalMl || 1}
                    size={64} strokeWidth={5} color="#5b9bd5" trackColor="rgba(52,63,42,0.08)"
                  >
                    <Droplet size={13} className="text-sky-500 mb-0.5" />
                    <span className="text-stone-800 text-xs font-bold leading-none">{(waterMl / 1000).toFixed(1)}L</span>
                  </ProgressRing>
                  <span className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">Água</span>
                </div>
              </div>

              <p className="text-stone-400 text-[11px] text-center pt-1 border-t border-sage-900/[0.05]">
                {Math.round(resumo.calorias_consumidas)} kcal hoje · meta de referência {resumo.calorias_meta} kcal
              </p>
            </motion.div>
          )}

          {/* Refeições */}
          <div className="space-y-3">
            {REFEICOES.map(({ key, label, emoji }) => {
              const itens = registros.filter(r => r.nome_refeicao === key)
              const kcal = caloriasRefeicao(key)
              const expanded = expandedRefeicao === key

              return (
                <div key={key} className="bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-3xl overflow-hidden">
                  <button
                    onClick={() => setExpandedRefeicao(expanded ? null : key)}
                    className="w-full flex items-center justify-between p-4 hover:bg-sand-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{emoji}</span>
                      <div className="text-left">
                        <p className="text-stone-800 text-sm font-semibold">{label}</p>
                        <p className="text-stone-400 text-xs">
                          {itens.length > 0 ? `${itens.length} item${itens.length > 1 ? 's' : ''} · ${Math.round(kcal)} kcal` : 'Nenhum registro'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/patient/diario/adicionar?refeicao=${key}`}
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 bg-sage-50 hover:bg-sage-100 text-sage-600 rounded-xl transition-colors"
                      >
                        <Plus size={14} />
                      </Link>
                      {expanded ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-sage-900/[0.05] divide-y divide-sage-900/[0.05]">
                          {itens.length === 0 ? (
                            <div className="px-4 py-5 text-center">
                              <Utensils size={20} className="text-stone-300 mx-auto mb-2" />
                              <p className="text-stone-400 text-xs">Nenhum alimento registrado</p>
                              <Link
                                href={`/patient/diario/adicionar?refeicao=${key}`}
                                className="text-sage-600 text-xs font-bold mt-1 inline-block"
                              >
                                + Adicionar alimento
                              </Link>
                            </div>
                          ) : (
                            itens.map(item => (
                              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-stone-800 text-sm font-medium truncate">{item.alimento_nome}</p>
                                  <p className="text-stone-400 text-xs">
                                    {item.quantidade_gramas}g · {Math.round(item.calorias_calculadas)} kcal
                                    {item.proteina_calculada != null && ` · P: ${Math.round(item.proteina_calculada)}g`}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  disabled={deletingId === item.id}
                                  className="p-1.5 text-stone-300 hover:text-rose-500 transition-colors disabled:opacity-50 ml-2 flex-shrink-0"
                                >
                                  {deletingId === item.id
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <Trash2 size={14} />
                                  }
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>

          {/* Empty state global */}
          {registros.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <Utensils size={32} className="text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 text-sm">Nenhum registro hoje</p>
              <p className="text-stone-400 text-xs mt-1">Adicione sua primeira refeição para começar</p>
              <Link
                href="/patient/diario/adicionar"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-2xl transition-all"
              >
                <Plus size={16} />
                Adicionar refeição
              </Link>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
