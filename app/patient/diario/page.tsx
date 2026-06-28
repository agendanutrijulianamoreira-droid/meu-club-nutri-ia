"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Utensils, Plus, Trash2, ChevronDown, ChevronUp,
  Flame, Drumstick, Wheat, Droplets, Leaf, Loader2,
} from "lucide-react"
import Link from "next/link"

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

const STATUS_META = {
  abaixo:   { label: 'Abaixo da meta',   color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25' },
  adequado: { label: 'Meta atingida',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  acima:    { label: 'Acima da meta',    color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/25' },
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function BarraProgresso({ valor, max, cor }: { valor: number; max: number; cor: string }) {
  const pct = max > 0 ? Math.min((valor / max) * 100, 100) : 0
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${cor}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  )
}

function ResumoMacros({ resumo }: { resumo: Resumo }) {
  const macros = [
    { label: 'Proteína', consumido: resumo.proteina_consumida, meta: resumo.proteina_meta, unidade: 'g', cor: 'bg-indigo-500', Icon: Drumstick },
    { label: 'Carbo',    consumido: resumo.carboidrato_consumido, meta: resumo.carboidrato_meta, unidade: 'g', cor: 'bg-amber-500', Icon: Wheat },
    { label: 'Gordura',  consumido: resumo.lipideos_consumido, meta: resumo.lipideos_meta, unidade: 'g', cor: 'bg-rose-400', Icon: Droplets },
    { label: 'Fibra',    consumido: resumo.fibra_consumida, meta: resumo.fibra_meta, unidade: 'g', cor: 'bg-emerald-500', Icon: Leaf },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {macros.map(({ label, consumido, meta, unidade, cor, Icon }) => (
        <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon size={12} className="text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
          </div>
          <p className="text-white text-sm font-bold mb-1">
            {consumido}<span className="text-slate-500 text-xs font-normal">/{meta}{unidade}</span>
          </p>
          <BarraProgresso valor={consumido} max={meta} cor={cor} />
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DiarioAlimentarPage() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedRefeicao, setExpandedRefeicao] = useState<string | null>('cafe_manha')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const hoje = new Date().toISOString().split('T')[0]

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

  const registrosPorRefeicao = (key: string) =>
    registros.filter(r => r.nome_refeicao === key)

  const caloriasRefeicao = (key: string) =>
    registros
      .filter(r => r.nome_refeicao === key)
      .reduce((acc, r) => acc + r.calorias_calculadas, 0)

  const statusMeta = resumo ? STATUS_META[resumo.status] : null

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-white">
            Diário <span className="font-bold">Alimentar</span>
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          href="/patient/diario/adicionar"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all"
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
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : (
        <>
          {/* Resumo calórico */}
          {resumo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-orange-400" />
                  <span className="text-white font-bold text-base">
                    {resumo.calorias_consumidas}
                    <span className="text-slate-500 text-sm font-normal"> / {resumo.calorias_meta} kcal</span>
                  </span>
                </div>
                {statusMeta && (
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusMeta.bg} ${statusMeta.color}`}>
                    {statusMeta.label}
                  </span>
                )}
              </div>

              {/* Barra calorias */}
              <BarraProgresso
                valor={resumo.calorias_consumidas}
                max={resumo.calorias_meta}
                cor={resumo.status === 'acima' ? 'bg-rose-400' : resumo.status === 'adequado' ? 'bg-emerald-500' : 'bg-indigo-500'}
              />

              <ResumoMacros resumo={resumo} />
            </motion.div>
          )}

          {/* Refeições */}
          <div className="space-y-3">
            {REFEICOES.map(({ key, label, emoji }) => {
              const itens = registros.filter(r => r.nome_refeicao === key)
              const kcal = caloriasRefeicao(key)
              const expanded = expandedRefeicao === key

              return (
                <div key={key} className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                  <button
                    onClick={() => setExpandedRefeicao(expanded ? null : key)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{emoji}</span>
                      <div className="text-left">
                        <p className="text-white text-sm font-bold">{label}</p>
                        <p className="text-slate-500 text-xs">
                          {itens.length > 0 ? `${itens.length} item${itens.length > 1 ? 's' : ''} · ${Math.round(kcal)} kcal` : 'Nenhum registro'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/patient/diario/adicionar?refeicao=${key}`}
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-xl transition-colors"
                      >
                        <Plus size={14} />
                      </Link>
                      {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
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
                        <div className="border-t border-white/5 divide-y divide-white/5">
                          {itens.length === 0 ? (
                            <div className="px-4 py-5 text-center">
                              <Utensils size={20} className="text-slate-700 mx-auto mb-2" />
                              <p className="text-slate-600 text-xs">Nenhum alimento registrado</p>
                              <Link
                                href={`/patient/diario/adicionar?refeicao=${key}`}
                                className="text-indigo-400 text-xs font-bold mt-1 inline-block"
                              >
                                + Adicionar alimento
                              </Link>
                            </div>
                          ) : (
                            itens.map(item => (
                              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-medium truncate">{item.alimento_nome}</p>
                                  <p className="text-slate-500 text-xs">
                                    {item.quantidade_gramas}g · {Math.round(item.calorias_calculadas)} kcal
                                    {item.proteina_calculada != null && ` · P: ${Math.round(item.proteina_calculada)}g`}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  disabled={deletingId === item.id}
                                  className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors disabled:opacity-50 ml-2 flex-shrink-0"
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
              <Utensils size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nenhum registro hoje</p>
              <p className="text-slate-600 text-xs mt-1">Adicione sua primeira refeição para começar</p>
              <Link
                href="/patient/diario/adicionar"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all"
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
