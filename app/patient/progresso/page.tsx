"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { TrendingUp, Activity, Utensils, Plus, Loader2 } from "lucide-react"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckinDiario {
  data: string
  nivel_energia: number | null
  nivel_inchaco: number | null
  nivel_compulsao: number | null
  qualidade_sono: number | null
  nivel_ansiedade: number | null
  dor_abdominal: number | null
  retencao_liquido: number | null
  humor: number | null
  peso_kg: number | null
  copos_agua: number | null
}

interface DiarioEntry {
  data: string
  calorias_calculadas: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODOS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
]

const SINTOMAS_CONFIG = [
  { key: 'nivel_energia',    label: 'Energia',     color: '#f59e0b' },
  { key: 'qualidade_sono',   label: 'Sono',        color: '#6366f1' },
  { key: 'humor',            label: 'Humor',       color: '#10b981' },
  { key: 'nivel_ansiedade',  label: 'Ansiedade',   color: '#f43f5e' },
  { key: 'nivel_inchaco',    label: 'Inchaço',     color: '#8b5cf6' },
]

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-bold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Selector de Período ──────────────────────────────────────────────────────

function SeletorPeriodo({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1">
      {PERIODOS.map(({ label, value: v }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
            value === v
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Formata data para exibição ───────────────────────────────────────────────

function fmtData(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProgressoPage() {
  const [periodo, setPeriodo] = useState(30)
  const [checkins, setCheckins] = useState<CheckinDiario[]>([])
  const [diario, setDiario] = useState<DiarioEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [metaCalorias] = useState(1800)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [ciRes, drRes] = await Promise.all([
        fetch(`/api/patient/checkin-diario?periodo=${periodo}`),
        fetch(`/api/patient/diario/historico?periodo=${periodo}`),
      ])
      if (ciRes.ok) {
        const { checkins: ci } = await ciRes.json()
        setCheckins(ci ?? [])
      }
      if (drRes.ok) {
        const { historico } = await drRes.json()
        setDiario(historico ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => { carregar() }, [carregar])

  // ── Peso ──
  const dadosPeso = checkins
    .filter(c => c.peso_kg != null)
    .map(c => ({ data: fmtData(c.data), Peso: c.peso_kg }))

  // ── Sintomas ──
  const dadosSintomas = checkins.map(c => ({
    data: fmtData(c.data),
    Energia: c.nivel_energia,
    Sono: c.qualidade_sono,
    Humor: c.humor,
    Ansiedade: c.nivel_ansiedade,
    Inchaço: c.nivel_inchaco,
  }))

  // ── Adesão alimentar por semana ──
  const semanas: Record<string, { total: number; count: number }> = {}
  diario.forEach(d => {
    const date = new Date(d.data + 'T00:00:00')
    const seg = new Date(date)
    seg.setDate(date.getDate() - date.getDay() + 1)
    const key = `${seg.getDate().toString().padStart(2, '0')}/${(seg.getMonth()+1).toString().padStart(2, '0')}`
    if (!semanas[key]) semanas[key] = { total: 0, count: 0 }
    semanas[key].total += d.calorias_calculadas
    semanas[key].count += 1
  })
  const dadosAdesao = Object.entries(semanas).map(([semana, { total, count }]) => ({
    semana,
    pct: count > 0 ? Math.round((total / count / metaCalorias) * 100) : 0,
  }))

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-white">
            Meu <span className="font-bold">Progresso</span>
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Acompanhamento de saúde</p>
        </div>
        <Link
          href="/patient/progresso/checkin"
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl transition-all"
        >
          <Plus size={14} />
          Check-in
        </Link>
      </div>

      {/* Seletor de período */}
      <SeletorPeriodo value={periodo} onChange={setPeriodo} />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : (
        <>
          {/* Gráfico de Peso */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-indigo-400" />
              <p className="text-white text-sm font-bold">Peso Corporal</p>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-indigo-500/10 border-indigo-500/25 text-indigo-400 ml-auto">kg</span>
            </div>

            {dadosPeso.length < 2 ? (
              <div className="text-center py-8">
                <TrendingUp size={24} className="text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-xs">Registre seu peso no check-in diário</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={dadosPeso}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Peso" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Gráfico de Sintomas */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-emerald-400" />
              <p className="text-white text-sm font-bold">Sintomas Subjetivos</p>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/25 text-emerald-400 ml-auto">0-10</span>
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-2 mb-3">
              {SINTOMAS_CONFIG.map(s => (
                <div key={s.key} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[10px] text-slate-400">{s.label}</span>
                </div>
              ))}
            </div>

            {dadosSintomas.length < 2 ? (
              <div className="text-center py-8">
                <Activity size={24} className="text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-xs">Faça check-ins diários para ver os gráficos</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dadosSintomas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {SINTOMAS_CONFIG.map(s => (
                    <Line key={s.key} type="monotone" dataKey={s.label} stroke={s.color} strokeWidth={1.5} dot={false} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Gráfico de Adesão */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Utensils size={16} className="text-amber-400" />
              <p className="text-white text-sm font-bold">Adesão Alimentar</p>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/25 text-amber-400 ml-auto">% meta</span>
            </div>

            {dadosAdesao.length === 0 ? (
              <div className="text-center py-8">
                <Utensils size={24} className="text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-xs">Registre refeições no diário alimentar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dadosAdesao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="semana" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 130]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="pct" name="Adesão %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Legenda da meta */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-emerald-500 rounded" />
                <span className="text-[10px] text-slate-500">85-115% = adequado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-amber-500 rounded" />
                <span className="text-[10px] text-slate-500">meta: {metaCalorias} kcal/dia</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
