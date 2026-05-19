"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell, Droplets, Utensils, Dumbbell, Pill, Plus, Trash2,
  ToggleLeft, ToggleRight, Check, X, AlertCircle, Loader2,
  ChevronLeft, Clock, Sparkles
} from "lucide-react"
import Link from "next/link"

interface Alarm {
  id: string
  type: 'water' | 'meal' | 'exercise' | 'medication' | 'custom'
  label: string
  time_hhmm: string
  days_of_week: number[]
  is_active: boolean
  push_title: string | null
  push_body: string | null
}

const TYPE_META = {
  water:      { label: 'Água',       icon: <Droplets size={16}/>,  color: 'text-sky-400',     bg: 'bg-sky-500/15 border-sky-500/25',     emoji: '💧' },
  meal:       { label: 'Refeição',   icon: <Utensils size={16}/>,  color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25', emoji: '🥗' },
  exercise:   { label: 'Exercício',  icon: <Dumbbell size={16}/>,  color: 'text-violet-400',  bg: 'bg-violet-500/15 border-violet-500/25',   emoji: '💪' },
  medication: { label: 'Suplemento',  icon: <Pill size={16}/>,      color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/25',     emoji: '💊' },
  custom:     { label: 'Personalizado', icon: <Bell size={16}/>,   color: 'text-rose-400',    bg: 'bg-rose-500/15 border-rose-500/25',       emoji: '⏰' },
}

const DAYS = [
  { value: 0, short: 'D', label: 'Dom' },
  { value: 1, short: 'S', label: 'Seg' },
  { value: 2, short: 'T', label: 'Ter' },
  { value: 3, short: 'Q', label: 'Qua' },
  { value: 4, short: 'Q', label: 'Qui' },
  { value: 5, short: 'S', label: 'Sex' },
  { value: 6, short: 'S', label: 'Sáb' },
]

const QUICK_PRESETS = [
  { label: '💧 Água manhã',      type: 'water' as const,  time: '07:30', days: [1,2,3,4,5,6,0] },
  { label: '💧 Água tarde',       type: 'water' as const,  time: '15:00', days: [1,2,3,4,5,6,0] },
  { label: '🥗 Café da manhã',   type: 'meal' as const,   time: '08:00', days: [1,2,3,4,5,6,0] },
  { label: '🥗 Almoço',          type: 'meal' as const,   time: '12:00', days: [1,2,3,4,5] },
  { label: '🥗 Jantar',          type: 'meal' as const,   time: '19:00', days: [1,2,3,4,5,6,0] },
  { label: '💪 Treino',          type: 'exercise' as const, time: '06:00', days: [1,3,5] },
  { label: '💊 Suplemento',       type: 'medication' as const, time: '08:00', days: [1,2,3,4,5,6,0] },
]

function AlarmCard({ alarm, onToggle, onDelete }: {
  alarm: Alarm
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
}) {
  const meta = TYPE_META[alarm.type]
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
        alarm.is_active ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-60'
      }`}>
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${alarm.is_active ? 'text-white' : 'text-slate-500'}`}>
          {alarm.label}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-mono text-indigo-400">{alarm.time_hhmm}</span>
          <span className="text-slate-700">·</span>
          <span className="text-[10px] text-slate-600">
            {alarm.days_of_week.length === 7
              ? 'Todos os dias'
              : alarm.days_of_week.sort().map(d => DAYS[d].label).join(', ')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => onToggle(alarm.id, !alarm.is_active)}
          className={`relative w-10 h-5 rounded-full transition-colors ${alarm.is_active ? 'bg-indigo-600' : 'bg-white/10'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${alarm.is_active ? 'left-5' : 'left-0.5'}`}/>
        </button>
        <button onClick={() => onDelete(alarm.id)}
          className="p-1.5 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
          <Trash2 size={13}/>
        </button>
      </div>
    </motion.div>
  )
}

function AlarmForm({ onSave, onCancel }: {
  onSave: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    type: 'water' as Alarm['type'],
    label: '',
    time_hhmm: '08:00',
    days_of_week: [1, 2, 3, 4, 5] as number[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter(d => d !== day)
        : [...f.days_of_week, day],
    }))
  }

  const selectPreset = (p: typeof QUICK_PRESETS[0]) => {
    setForm(f => ({
      ...f,
      type: p.type,
      label: p.label.replace(/^.{2}\s/, ''), // remove emoji
      time_hhmm: p.time,
      days_of_week: p.days,
    }))
  }

  const handleSave = async () => {
    if (!form.label.trim()) { setError('Dê um nome para o lembrete'); return }
    if (form.days_of_week.length === 0) { setError('Selecione pelo menos um dia'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/patient/alarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Erro'); return }
      onSave()
    } catch {
      setError('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-indigo-500/20 rounded-3xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">Novo Lembrete</p>
        <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
          <X size={16}/>
        </button>
      </div>

      {/* Presets rápidos */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Modelos rápidos</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PRESETS.map(p => (
            <button key={p.label} onClick={() => selectPreset(p)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:border-indigo-500/30 hover:text-white transition-all">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tipo */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Tipo</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.entries(TYPE_META) as [Alarm['type'], typeof TYPE_META['water']][]).map(([key, meta]) => (
            <button key={key} onClick={() => set('type', key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] font-bold transition-all ${
                form.type === key ? `${meta.bg} ${meta.color} border-current` : 'bg-white/3 border-white/8 text-slate-600 hover:border-white/15'
              }`}>
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nome + Horário */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 md:col-span-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Nome do lembrete</p>
          <input value={form.label} onChange={e => set('label', e.target.value)}
            placeholder="Ex: Água das 10h"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"/>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Horário</p>
          <input type="time" value={form.time_hhmm} onChange={e => set('time_hhmm', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"/>
        </div>
      </div>

      {/* Dias da semana */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Dias da semana</p>
        <div className="flex gap-1.5">
          {DAYS.map(d => (
            <button key={d.value} onClick={() => toggleDay(d.value)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                form.days_of_week.includes(d.value)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/5 border border-white/10 text-slate-500 hover:border-white/20'
              }`}>
              {d.short}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-1.5">
          <button onClick={() => set('days_of_week', [1,2,3,4,5])}
            className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors">Dias úteis</button>
          <button onClick={() => set('days_of_week', [0,1,2,3,4,5,6])}
            className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors">Todos os dias</button>
          <button onClick={() => set('days_of_week', [0,6])}
            className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors">Fim de semana</button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-rose-400">
          <AlertCircle size={13}/> {error}
        </p>
      )}

      <button onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
        {saving ? <Loader2 size={15} className="animate-spin"/> : <Bell size={15}/>}
        {saving ? 'Salvando…' : 'Criar Lembrete'}
      </button>
    </motion.div>
  )
}

export default function AlarmsPage() {
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/patient/alarms')
      const data = await res.json()
      setAlarms(data.alarms || [])
    } catch {
      showToast('error', 'Erro ao carregar lembretes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (id: string, active: boolean) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, is_active: active } : a))
    await fetch('/api/patient/alarms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: active }),
    })
  }

  const handleDelete = async (id: string) => {
    setAlarms(prev => prev.filter(a => a.id !== id))
    await fetch('/api/patient/alarms', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    showToast('success', 'Lembrete removido')
  }

  const handleSave = () => {
    setShowForm(false)
    load()
    showToast('success', 'Lembrete criado!')
  }

  const activeCount = alarms.filter(a => a.is_active).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0f172a] to-[#1e1b4b]">
      {/* Header */}
      <div className="sticky top-0 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/patient/profile"
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all">
            <ChevronLeft size={20}/>
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white">Meus Lembretes</h1>
            <p className="text-[11px] text-slate-500">{activeCount} ativo{activeCount !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all">
            <Plus size={13}/> Novo
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-4">
        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium ${
                toast.type === 'success' ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/25 text-rose-400'
              }`}>
              {toast.type === 'success' ? <Check size={14}/> : <AlertCircle size={14}/>} {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Formulário */}
        <AnimatePresence mode="wait">
          {showForm && <AlarmForm key="form" onSave={handleSave} onCancel={() => setShowForm(false)}/>}
        </AnimatePresence>

        {/* Info card */}
        {!showForm && (
          <div className="flex items-start gap-3 p-3 bg-indigo-500/8 border border-indigo-500/15 rounded-2xl">
            <Bell size={14} className="text-indigo-400 shrink-0 mt-0.5"/>
            <p className="text-xs text-slate-400">
              Os lembretes chegam como notificação push no seu celular no horário programado.
              Certifique-se de que as notificações estão ativadas para este site.
            </p>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-slate-600"/>
          </div>
        ) : alarms.length === 0 && !showForm ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">⏰</div>
            <p className="text-slate-400 font-medium mb-1">Nenhum lembrete ainda</p>
            <p className="text-slate-600 text-sm mb-5">Crie lembretes de água, refeições e hábitos para o dia a dia</p>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all mx-auto">
              <Plus size={14}/> Criar primeiro lembrete
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {alarms.map(a => (
                <AlarmCard key={a.id} alarm={a} onToggle={handleToggle} onDelete={handleDelete}/>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
