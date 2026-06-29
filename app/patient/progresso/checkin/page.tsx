"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Check, Loader2, ChevronRight } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SintomaConfig {
  key: string
  label: string
  emoji: string
  desc: string        // orientação de leitura da escala
  invertido?: boolean // true = 0 é bom, 10 é ruim (ex: inchaço)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SINTOMAS: SintomaConfig[] = [
  { key: 'nivel_energia',    label: 'Energia',          emoji: '⚡', desc: '0 = sem energia · 10 = máxima energia' },
  { key: 'humor',            label: 'Humor',            emoji: '😊', desc: '0 = péssimo · 10 = ótimo' },
  { key: 'qualidade_sono',   label: 'Qualidade do sono',emoji: '😴', desc: '0 = péssimo · 10 = excelente' },
  { key: 'nivel_inchaco',    label: 'Inchaço',          emoji: '💧', desc: '0 = sem inchaço · 10 = muito inchada', invertido: true },
  { key: 'nivel_ansiedade',  label: 'Ansiedade',        emoji: '😰', desc: '0 = calma · 10 = muito ansiosa', invertido: true },
  { key: 'nivel_compulsao',  label: 'Compulsão',        emoji: '🍫', desc: '0 = sem compulsão · 10 = compulsão intensa', invertido: true },
  { key: 'dor_abdominal',    label: 'Dor abdominal',    emoji: '🌀', desc: '0 = sem dor · 10 = dor intensa', invertido: true },
  { key: 'retencao_liquido', label: 'Retenção de líquido', emoji: '💦', desc: '0 = sem retenção · 10 = muita retenção', invertido: true },
]

const FASES_CICLO = [
  { value: 'menstrual',  label: 'Menstrual',   emoji: '🌑' },
  { value: 'folicular',  label: 'Folicular',   emoji: '🌒' },
  { value: 'ovulatoria', label: 'Ovulatória',  emoji: '🌕' },
  { value: 'lutea',      label: 'Lútea',       emoji: '🌘' },
]

// ─── Slider Component ─────────────────────────────────────────────────────────

function SliderSintoma({
  config,
  value,
  onChange,
}: {
  config: SintomaConfig
  value: number
  onChange: (v: number) => void
}) {
  const cor = config.invertido
    ? value <= 3 ? 'bg-emerald-500' : value <= 6 ? 'bg-amber-500' : 'bg-rose-500'
    : value <= 3 ? 'bg-rose-500'    : value <= 6 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.emoji}</span>
          <span className="text-white text-sm font-medium">{config.label}</span>
        </div>
        <span className={`text-lg font-black ${
          config.invertido
            ? value <= 3 ? 'text-emerald-400' : value <= 6 ? 'text-amber-400' : 'text-rose-400'
            : value <= 3 ? 'text-rose-400'    : value <= 6 ? 'text-amber-400' : 'text-emerald-400'
        }`}>{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10"
        style={{ accentColor: value <= 3 ? (config.invertido ? '#10b981' : '#f43f5e') : value <= 6 ? '#f59e0b' : (config.invertido ? '#f43f5e' : '#10b981') }}
      />
      <p className="text-slate-600 text-[10px]">{config.desc}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckinDiarioPage() {
  const router = useRouter()

  const [step, setStep] = useState<'sintomas' | 'objetivos' | 'ciclo' | 'done'>('sintomas')
  const [jaFezHoje, setJaFezHoje] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const hoje = new Date().toISOString().split('T')[0]

  const [sintomas, setSintomas] = useState<Record<string, number>>(
    Object.fromEntries(SINTOMAS.map(s => [s.key, 5]))
  )
  const [peso, setPeso] = useState('')
  const [horasSono, setHorasSono] = useState('')
  const [copasAgua, setCopasAgua] = useState('')
  const [faseCiclo, setFaseCiclo] = useState('')
  const [diaCiclo, setDiaCiclo] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    fetch(`/api/patient/checkin-diario?data=${hoje}`)
      .then(r => r.json())
      .then(d => { if (d.registro) setJaFezHoje(true) })
      .catch(() => {})
      .finally(() => setVerificando(false))
  }, [hoje])

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      const res = await fetch('/api/patient/checkin-diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sintomas,
          peso_kg:      peso      ? parseFloat(peso)      : null,
          horas_sono:   horasSono ? parseFloat(horasSono) : null,
          copos_agua:   copasAgua ? parseInt(copasAgua)   : null,
          fase_ciclo:   faseCiclo || null,
          dia_ciclo:    diaCiclo  ? parseInt(diaCiclo)    : null,
          observacoes:  observacoes || null,
        }),
      })

      if (res.status === 409) {
        showToast('error', 'Você já fez o check-in de hoje!')
        setJaFezHoje(true)
        return
      }
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao salvar')
      }

      setStep('done')
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (verificando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
          <ArrowLeft size={18} className="text-slate-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Check-in do Dia</h1>
          <p className="text-slate-500 text-xs">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
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

      {/* Já fez hoje */}
      {jaFezHoje && step !== 'done' && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-center">
          <p className="text-amber-400 font-bold text-sm">Check-in já realizado hoje ✓</p>
          <p className="text-amber-400/70 text-xs mt-1">Volte amanhã para registrar novamente</p>
          <button
            onClick={() => router.push('/patient/progresso')}
            className="mt-3 text-amber-400 text-xs font-bold underline"
          >
            Ver meu progresso →
          </button>
        </div>
      )}

      {/* Done */}
      <AnimatePresence mode="wait">
        {step === 'done' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-10 space-y-4"
          >
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <Check size={32} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white text-lg font-bold">Check-in registrado!</p>
              <p className="text-slate-500 text-sm mt-1">Seus dados foram salvos para os gráficos de progresso</p>
            </div>
            <button
              onClick={() => router.push('/patient/progresso')}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all"
            >
              Ver meu progresso <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {/* Sintomas */}
        {step === 'sintomas' && !jaFezHoje && (
          <motion.div
            key="sintomas"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Como você está hoje?</p>
              {SINTOMAS.map(config => (
                <SliderSintoma
                  key={config.key}
                  config={config}
                  value={sintomas[config.key]}
                  onChange={v => setSintomas(prev => ({ ...prev, [config.key]: v }))}
                />
              ))}
            </div>
            <button
              onClick={() => setStep('objetivos')}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all"
            >
              Continuar <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {/* Objetivos */}
        {step === 'objetivos' && (
          <motion.div
            key="objetivos"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Dados objetivos (opcional)</p>

              {[
                { label: 'Peso (kg)', value: peso, set: setPeso, placeholder: '65.5', type: 'number' },
                { label: 'Horas de sono', value: horasSono, set: setHorasSono, placeholder: '7.5', type: 'number' },
                { label: 'Copos de água', value: copasAgua, set: setCopasAgua, placeholder: '8', type: 'number' },
              ].map(({ label, value, set, placeholder, type }) => (
                <div key={label}>
                  <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
              ))}

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Observações livres</label>
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  placeholder="Como foi seu dia? Algo diferente?"
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('sintomas')}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-bold rounded-2xl transition-all"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep('ciclo')}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all"
              >
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Ciclo */}
        {step === 'ciclo' && (
          <motion.div
            key="ciclo"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Ciclo menstrual (opcional)</p>

              <div className="grid grid-cols-2 gap-2">
                {FASES_CICLO.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFaseCiclo(faseCiclo === f.value ? '' : f.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      faseCiclo === f.value
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <span>{f.emoji}</span> {f.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Dia do ciclo (ex: 14)</label>
                <input
                  type="number"
                  value={diaCiclo}
                  onChange={e => setDiaCiclo(e.target.value)}
                  placeholder="Dia 1–28"
                  min={1}
                  max={35}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('objetivos')}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-bold rounded-2xl transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
              >
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {salvando ? 'Salvando...' : 'Concluir check-in'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
