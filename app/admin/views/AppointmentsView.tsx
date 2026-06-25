"use client"

import React, { useState, useEffect } from 'react'
import {
  Calendar, Clock, Video, MapPin, Plus, Loader2, CheckCircle2, XCircle,
  User, ChevronRight, AlertCircle, RefreshCw, Phone, ExternalLink, Trash2,
  ChevronLeft, LayoutGrid, List
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

interface AppointmentsViewProps {
  setView: (v: any) => void
  tenantId?: string
}

interface Appointment {
  id: string
  scheduled_at: string
  duration_minutes: number
  appointment_type: string
  is_virtual: boolean
  meeting_link?: string
  location_address?: string
  status: string
  notes?: string
  patient?: { name: string; user_id: string; primary_goal?: string }
  nutritionist?: { name: string }
}

interface Patient {
  user_id: string
  name: string
  primary_goal?: string
  current_streak?: number
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  consultation: { label: 'Consulta', color: 'text-indigo-400' },
  followup: { label: 'Retorno', color: 'text-teal-400' },
  initial_assessment: { label: 'Avaliação inicial', color: 'text-purple-400' },
  group_session: { label: 'Sessão em grupo', color: 'text-amber-400' },
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  scheduled: { label: 'Agendada', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  confirmed: { label: 'Confirmada', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  completed: { label: 'Realizada', bg: 'bg-slate-500/10', text: 'text-slate-400' },
  cancelled: { label: 'Cancelada', bg: 'bg-rose-500/10', text: 'text-rose-400' },
  no_show: { label: 'Não compareceu', bg: 'bg-amber-500/10', text: 'text-amber-400' },
}

export function AppointmentsView({ setView, tenantId }: AppointmentsViewProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'completed'>('upcoming')
  const [view, setViewMode] = useState<'list' | 'week'>('list')
  const [weekOffset, setWeekOffset] = useState(0)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Form state
  const [formPatientId, setFormPatientId] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('09:00')
  const [formDuration, setFormDuration] = useState(60)
  const [formType, setFormType] = useState('consultation')
  const [formVirtual, setFormVirtual] = useState(true)
  const [formMeetingLink, setFormMeetingLink] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formSyncGcal, setFormSyncGcal] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => { loadData() }, [filter])

  const loadData = async () => {
    setLoading(true)
    try {
      const upcomingParam = filter === 'upcoming' ? '&upcoming=true' : filter === 'completed' ? '&status=completed' : ''
      const [apptRes, patientsRes] = await Promise.all([
        fetch(`/api/admin/appointments?${upcomingParam}`),
        fetch('/api/admin/patients/[id]/action'.replace('[id]', 'list')).catch(() => null),
      ])

      const apptData = await apptRes.json()
      setAppointments(apptData.appointments || [])

      // Load patients for the form
      if (!patients.length) {
        const pRes = await fetch('/api/admin/dashboard')
        const pData = await pRes.json()
        if (pData.patients) setPatients(pData.patients)
      }
    } catch { showToast('Erro ao carregar', 'error') }
    finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    if (!formPatientId || !formDate || !formTime) {
      showToast('Preencha paciente, data e hora', 'error')
      return
    }
    setSubmitting(true)
    try {
      const scheduledAt = `${formDate}T${formTime}:00-03:00` // BRT
      const res = await fetch('/api/admin/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: formPatientId,
          scheduled_at: scheduledAt,
          duration_minutes: formDuration,
          appointment_type: formType,
          is_virtual: formVirtual,
          meeting_link: formMeetingLink || undefined,
          notes: formNotes || undefined,
          sync_google_calendar: formSyncGcal,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      showToast('Consulta agendada! Paciente notificada no inbox.')
      setShowForm(false)
      resetForm()
      loadData()
    } catch (err: any) {
      showToast(err.message || 'Erro ao agendar', 'error')
    } finally { setSubmitting(false) }
  }

  const updateStatus = async (id: string, status: string, reason?: string) => {
    try {
      await fetch('/api/admin/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: id, status, cancellation_reason: reason }),
      })
      showToast(`Status atualizado: ${STATUS_STYLES[status]?.label || status}`)
      loadData()
    } catch { showToast('Erro ao atualizar', 'error') }
  }

  const resetForm = () => {
    setFormPatientId(''); setFormDate(''); setFormTime('09:00'); setFormDuration(60)
    setFormType('consultation'); setFormVirtual(true); setFormMeetingLink(''); setFormNotes('')
  }

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return {
      date: d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }),
      time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="text-teal-400" size={28} />
            Agenda de Consultas
          </h1>
          <p className="text-slate-400 mt-1">Agende consultas e sincronize com Google Calendar</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Plus size={16} /> Nova consulta
        </Button>
      </div>

      {/* New Appointment Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="bg-slate-800/40 rounded-xl border border-indigo-500/30 p-6 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><Plus size={16} className="text-indigo-400" /> Agendar consulta</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Paciente</label>
                  <select value={formPatientId} onChange={e => setFormPatientId(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="">Selecione...</option>
                    {patients.map(p => (
                      <option key={p.user_id} value={p.user_id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Data</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Hora</label>
                  <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                  <select value={formType} onChange={e => setFormType(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Duração</label>
                  <select value={formDuration} onChange={e => setFormDuration(Number(e.target.value))}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm">
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1h30</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Formato</label>
                  <div className="flex gap-2">
                    <button onClick={() => setFormVirtual(true)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${formVirtual ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                      <Video size={14} /> Online
                    </button>
                    <button onClick={() => setFormVirtual(false)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${!formVirtual ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                      <MapPin size={14} /> Presencial
                    </button>
                  </div>
                </div>
              </div>

              {formVirtual && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Link da reunião (Google Meet, Zoom, etc)</label>
                  <input value={formMeetingLink} onChange={e => setFormMeetingLink(e.target.value)} placeholder="https://meet.google.com/..."
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Observações (opcional)</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Preparar exames, levar diário alimentar..."
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm resize-none" />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formSyncGcal} onChange={e => setFormSyncGcal(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700" />
                  <span className="text-sm text-slate-400 flex items-center gap-1">
                    <Calendar size={14} className="text-blue-400" /> Sincronizar com Google Calendar
                  </span>
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }} className="border-slate-600 text-slate-400">Cancelar</Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Agendar
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters + View Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg w-fit">
          {([['upcoming', 'Próximas'], ['all', 'Todas'], ['completed', 'Realizadas']] as const).map(([f, label]) => (
            <button key={f} onClick={() => { setFilter(f); setViewMode('list') }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === f && view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg">
          <button onClick={() => setViewMode('list')} title="Lista"
            className={`px-3 py-2 rounded-md transition-all ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
            <List size={15} />
          </button>
          <button onClick={() => setViewMode('week')} title="Semana"
            className={`px-3 py-2 rounded-md transition-all ${view === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* Week View */}
      {view === 'week' && (() => {
        const today = new Date()
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7) // Monday
        startOfWeek.setHours(0, 0, 0, 0)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        endOfWeek.setHours(23, 59, 59, 999)

        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(startOfWeek)
          d.setDate(startOfWeek.getDate() + i)
          return d
        })

        const weekLabel = `${startOfWeek.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${endOfWeek.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`

        const apptsByDay = (dayDate: Date) => appointments.filter(a => {
          const d = new Date(a.scheduled_at)
          return d.toDateString() === dayDate.toDateString()
        })

        return (
          <div className="space-y-4">
            {/* Week nav */}
            <div className="flex items-center justify-between">
              <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <p className="text-white font-semibold text-sm">{weekLabel}</p>
                {weekOffset === 0 && <p className="text-xs text-indigo-400">Esta semana</p>}
                {weekOffset > 0 && <button onClick={() => setWeekOffset(0)} className="text-xs text-slate-500 hover:text-slate-300">Voltar à semana atual</button>}
              </div>
              <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day columns */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((dayDate, di) => {
                const isToday = dayDate.toDateString() === today.toDateString()
                const dayAppts = apptsByDay(dayDate)
                const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
                return (
                  <div key={di} className={`rounded-xl border p-2 min-h-[120px] ${isToday ? 'border-indigo-500/40 bg-indigo-600/5' : 'border-slate-700/50 bg-slate-800/20'}`}>
                    <div className={`text-center mb-2 ${isToday ? 'text-indigo-400' : 'text-slate-500'}`}>
                      <p className="text-[10px] font-black uppercase">{WEEKDAYS[di]}</p>
                      <p className={`text-lg font-black ${isToday ? 'text-indigo-400' : 'text-slate-400'}`}>{dayDate.getDate()}</p>
                    </div>
                    <div className="space-y-1">
                      {dayAppts.map(appt => {
                        const time = new Date(appt.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                        const status = STATUS_STYLES[appt.status] || STATUS_STYLES.scheduled
                        return (
                          <div key={appt.id} className={`px-1.5 py-1 rounded-lg text-[10px] ${status.bg} border border-white/5`}>
                            <p className={`font-black ${status.text}`}>{time}</p>
                            <p className="text-white font-medium truncate">{appt.patient?.name || 'Paciente'}</p>
                          </div>
                        )
                      })}
                      {dayAppts.length === 0 && (
                        <p className="text-[10px] text-slate-700 text-center mt-2">—</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Appointments List */}
      {view === 'list' && (
        loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">{filter === 'upcoming' ? 'Nenhuma consulta agendada.' : 'Nenhuma consulta encontrada.'}</p>
          </div>
        ) : (
        <div className="space-y-3">
          {appointments.map((appt, i) => {
            const { date, time } = formatDateTime(appt.scheduled_at)
            const type = TYPE_LABELS[appt.appointment_type] || TYPE_LABELS.consultation
            const status = STATUS_STYLES[appt.status] || STATUS_STYLES.scheduled
            const isUpcoming = new Date(appt.scheduled_at) > new Date()

            return (
              <motion.div key={appt.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 hover:border-slate-600/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* DateTime block */}
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-bold text-white">{time}</p>
                      <p className="text-xs text-slate-500">{date}</p>
                    </div>
                    {/* Divider */}
                    <div className="w-px h-12 bg-slate-700/50" />
                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-semibold ${type.color}`}>{type.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>{status.label}</span>
                        {appt.is_virtual && <Video size={12} className="text-blue-400" />}
                      </div>
                      <p className="text-sm text-white flex items-center gap-1">
                        <User size={12} className="text-slate-500" />
                        {appt.patient?.name || 'Paciente'}
                      </p>
                      {appt.notes && <p className="text-xs text-slate-500 mt-1">{appt.notes}</p>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {appt.meeting_link && isUpcoming && (
                      <a href={appt.meeting_link} target="_blank" rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition-colors" title="Abrir link">
                        <ExternalLink size={16} />
                      </a>
                    )}
                    {appt.status === 'scheduled' && (
                      <>
                        <button onClick={() => updateStatus(appt.id, 'confirmed')}
                          className="p-2 rounded-lg hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 transition-colors" title="Confirmar">
                          <CheckCircle2 size={16} />
                        </button>
                        <button onClick={() => updateStatus(appt.id, 'cancelled', 'Cancelado pelo profissional')}
                          className="p-2 rounded-lg hover:bg-slate-700 text-rose-400 hover:text-rose-300 transition-colors" title="Cancelar">
                          <XCircle size={16} />
                        </button>
                      </>
                    )}
                    {(appt.status === 'confirmed' || appt.status === 'scheduled') && !isUpcoming && (
                      <>
                        <button onClick={() => updateStatus(appt.id, 'completed')}
                          className="px-3 py-1.5 rounded-lg text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30">Marcar realizada</button>
                        <button onClick={() => updateStatus(appt.id, 'no_show')}
                          className="px-3 py-1.5 rounded-lg text-xs bg-amber-600/20 text-amber-400 hover:bg-amber-600/30">Não compareceu</button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
        )
      )}
    </div>
  )
}
