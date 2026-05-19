"use client"

import { useState, useEffect } from "react"
import { X, Bell, Droplets, Coffee, Sun, Sunset, Moon, Loader2, Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Reminder {
  id?: string
  reminder_type: string
  label: string
  time_local: string
  days_of_week: number[]
  message: string
  is_active: boolean
}

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]

const DEFAULT_REMINDERS: Omit<Reminder, 'id'>[] = [
  {
    reminder_type: 'water',
    label: 'Beber água 💧',
    time_local: '08:00',
    days_of_week: ALL_DAYS,
    message: 'Hora de hidratar! Seu corpo agradece. 💧',
    is_active: false,
  },
  {
    reminder_type: 'breakfast',
    label: 'Café da manhã ☀️',
    time_local: '07:30',
    days_of_week: WEEKDAYS,
    message: 'Bom dia! Não esqueça do seu café da manhã nutritivo. ☀️',
    is_active: false,
  },
  {
    reminder_type: 'lunch',
    label: 'Almoço 🍽️',
    time_local: '12:00',
    days_of_week: ALL_DAYS,
    message: 'Hora do almoço! Lembre-se de comer devagar e com atenção. 🍽️',
    is_active: false,
  },
  {
    reminder_type: 'dinner',
    label: 'Jantar 🌙',
    time_local: '19:00',
    days_of_week: ALL_DAYS,
    message: 'Hora do jantar! Prefira algo leve e nutritivo. 🌙',
    is_active: false,
  },
  {
    reminder_type: 'snack',
    label: 'Lanche da tarde 🍎',
    time_local: '15:30',
    days_of_week: WEEKDAYS,
    message: 'Lanche da tarde! Uma fruta ou oleaginosas são ótimas opções. 🍎',
    is_active: false,
  },
]

const TYPE_ICONS: Record<string, React.ElementType> = {
  water: Droplets,
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Sunset,
  custom: Bell,
}

const TYPE_COLORS: Record<string, string> = {
  water: 'text-blue-400',
  breakfast: 'text-amber-400',
  lunch: 'text-orange-400',
  dinner: 'text-indigo-400',
  snack: 'text-emerald-400',
  custom: 'text-purple-400',
}

export function ReminderSettings({ onClose }: { onClose: () => void }) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    fetch('/api/patient/reminders')
      .then(r => r.json())
      .then((saved: Reminder[]) => {
        // Merge defaults with saved
        const merged = DEFAULT_REMINDERS.map(def => {
          const found = saved.find(s => s.reminder_type === def.reminder_type)
          return found ?? { ...def }
        })
        // Add any custom reminders not in defaults
        const customs = saved.filter(s => !DEFAULT_REMINDERS.find(d => d.reminder_type === s.reminder_type))
        setReminders([...merged, ...customs])
      })
      .catch(() => setReminders(DEFAULT_REMINDERS.map(d => ({ ...d }))))
      .finally(() => setLoading(false))
  }, [])

  const saveReminder = async (reminder: Reminder) => {
    setSaving(reminder.reminder_type)
    try {
      await fetch('/api/patient/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminder),
      })
      showToast('Lembrete salvo!')
    } catch {
      showToast('Erro ao salvar')
    } finally {
      setSaving(null)
    }
  }

  const toggleActive = async (idx: number) => {
    const updated = reminders.map((r, i) => i === idx ? { ...r, is_active: !r.is_active } : r)
    setReminders(updated)
    await saveReminder(updated[idx])
  }

  const updateTime = (idx: number, time: string) => {
    setReminders(prev => prev.map((r, i) => i === idx ? { ...r, time_local: time } : r))
  }

  const toggleDay = (idx: number, day: number) => {
    setReminders(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const days = r.days_of_week.includes(day)
        ? r.days_of_week.filter(d => d !== day)
        : [...r.days_of_week, day].sort((a, b) => a - b)
      return { ...r, days_of_week: days }
    }))
  }

  const handleBlur = (reminder: Reminder) => {
    if (reminder.is_active) saveReminder(reminder)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm overflow-y-auto"
    >
      <div className="max-w-[430px] mx-auto min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-slate-950/90 backdrop-blur-xl border-b border-white/5">
          <div>
            <h2 className="text-white font-bold text-lg">Meus Lembretes</h2>
            <p className="text-slate-500 text-xs">Configure seus horários personalizados</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white/5 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 pb-20">
          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-2.5 rounded-2xl"
              >
                <Check className="w-4 h-4" /> {toast}
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : (
            reminders.map((reminder, idx) => {
              const Icon = TYPE_ICONS[reminder.reminder_type] ?? Bell
              const color = TYPE_COLORS[reminder.reminder_type] ?? 'text-slate-400'
              const isSaving = saving === reminder.reminder_type

              return (
                <div
                  key={reminder.reminder_type}
                  className={`bg-slate-900/80 border rounded-3xl p-4 transition-all ${reminder.is_active ? 'border-white/15' : 'border-white/5 opacity-60'}`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-white/5 flex items-center justify-center">
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <span className="text-white text-sm font-medium">{reminder.label}</span>
                      {isSaving && <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />}
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={() => toggleActive(idx)}
                      className={`relative rounded-full transition-colors flex-shrink-0 ${reminder.is_active ? 'bg-emerald-600' : 'bg-white/10'}`}
                      style={{ height: '22px', width: '42px' }}
                    >
                      <div
                        className="absolute top-0.5 rounded-full bg-white shadow transition-all"
                        style={{
                          width: '18px',
                          height: '18px',
                          left: reminder.is_active ? '22px' : '2px',
                        }}
                      />
                    </button>
                  </div>

                  {/* Time + days (only if active) */}
                  <AnimatePresence>
                    {reminder.is_active && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-1 space-y-3">
                          {/* Time picker */}
                          <div className="flex items-center gap-3">
                            <p className="text-slate-500 text-xs w-12">Horário</p>
                            <input
                              type="time"
                              value={reminder.time_local}
                              onChange={e => updateTime(idx, e.target.value)}
                              onBlur={() => handleBlur(reminder)}
                              className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>
                          {/* Days of week */}
                          <div className="flex items-center gap-2">
                            <p className="text-slate-500 text-xs w-12">Dias</p>
                            <div className="flex gap-1">
                              {ALL_DAYS.map(day => (
                                <button
                                  key={day}
                                  onClick={() => toggleDay(idx, day)}
                                  onBlur={() => handleBlur(reminder)}
                                  className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all ${reminder.days_of_week.includes(day) ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                                >
                                  {DAY_LABELS[day]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })
          )}

          {/* Info note */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3">
            <p className="text-slate-500 text-xs leading-relaxed">
              Os lembretes são enviados como notificações push. Certifique-se de ter as notificações ativadas para este site.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
