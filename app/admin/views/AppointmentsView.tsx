"use client"

import React, { useState, useEffect } from 'react'
import {
  Calendar, Clock, Video, MapPin, Plus, Loader2, CheckCircle2, XCircle,
  User, ChevronRight, AlertCircle, RefreshCw, Phone, ExternalLink, Trash2,
  ChevronLeft, LayoutGrid, List, Settings, Save, FileText, FileDown, X, Sparkles
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { exportRelatorioPdf } from "@/lib/utils/exportRelatorioPdf"

interface AppointmentsViewProps {
  setView: (v: any) => void
  tenantId?: string
  tenantName?: string
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

interface RelatorioPreConsulta {
  id: string
  paciente_id: string
  periodo_inicio: string
  periodo_fim: string
  dados_json: any
  analise_clinica: string
  created_at: string
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

export function AppointmentsView({ setView, tenantId, tenantName }: AppointmentsViewProps) {
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

  // Availability settings
  const [showSettings, setShowSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [availSettings, setAvailSettings] = useState({
    work_days: [1, 2, 3, 4, 5] as number[],
    work_hours_start: '08:00',
    work_hours_end: '18:00',
    slot_duration_minutes: 60,
    buffer_minutes: 10,
    default_meeting_link: '',
  })

  // Relatório pré-consulta (Fase 8)
  const [relatorioAppt, setRelatorioAppt] = useState<Appointment | null>(null)
  const [relatorio, setRelatorio] = useState<RelatorioPreConsulta | null>(null)
  const [loadingRelatorio, setLoadingRelatorio] = useState(false)
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => { loadData() }, [filter])

  useEffect(() => {
    fetch('/api/admin/availability')
      .then(r => r.json())
      .then(d => {
        if (d.settings) {
          setAvailSettings(prev => ({ ...prev, ...d.settings }))
          // Pre-fill default meeting link in new appointment form
          if (d.settings.default_meeting_link) {
            setFormMeetingLink(d.settings.default_meeting_link)
          }
          // Pre-fill default duration
          if (d.settings.slot_duration_minutes) {
            setFormDuration(d.settings.slot_duration_minutes)
          }
        }
      })
      .catch(() => {})
  }, [])

  const saveAvailability = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/admin/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendar_settings: availSettings }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Disponibilidade salva!')
      setShowSettings(false)
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar', 'error')
    } finally { setSavingSettings(false) }
  }

  const toggleWorkDay = (day: number) => {
    setAvailSettings(prev => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter(d => d !== day)
        : [...prev.work_days, day].sort(),
    }))
  }

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

  const openRelatorio = async (appt: Appointment) => {
    setRelatorioAppt(appt)
    setRelatorio(null)
    setLoadingRelatorio(true)
    try {
      const res = await fetch(`/api/admin/relatorios/pre-consulta?appointment_id=${appt.id}`)
      const data = await res.json()
      setRelatorio(data.relatorio || null)
    } catch {
      showToast('Erro ao carregar relatório', 'error')
    } finally {
      setLoadingRelatorio(false)
    }
  }

  const gerarRelatorio = async () => {
    if (!relatorioAppt) return
    setGerandoRelatorio(true)
    try {
      const res = await fetch('/api/admin/relatorios/pre-consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: relatorioAppt.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar relatório')
      setRelatorio(data.relatorio)
      showToast('Relatório gerado com sucesso!')
    } catch (err: any) {
      showToast(err.message || 'Erro ao gerar relatório', 'error')
    } finally {
      setGerandoRelatorio(false)
    }
  }

  const exportarRelatorio = () => {
    if (!relatorio) return
    exportRelatorioPdf({
      tenantName,
      dados: relatorio.dados_json,
      analiseClinica: relatorio.analise_clinica,
    })
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
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-xl border transition-all ${showSettings ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'}`}
            title="Configurar disponibilidade">
            <Settings size={16} />
          </button>
          <Button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus size={16} /> Nova consulta
          </Button>
        </div>
      </div>

      {/* Availability Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="bg-slate-800/40 rounded-xl border border-teal-500/20 p-6 space-y-5">
              <p className="text-white font-semibold flex items-center gap-2 text-sm">
                <Settings size={15} className="text-teal-400" /> Disponibilidade & Configurações
              </p>

              {/* Work days */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Dias disponíveis</label>
                <div className="flex gap-2 flex-wrap">
                  {[['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6], ['Dom', 0]].map(([label, day]) => (
                    <button key={day} onClick={() => toggleWorkDay(day as number)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        availSettings.work_days.includes(day as number)
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Work hours */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Início</label>
                  <input type="time" value={availSettings.work_hours_start}
                    onChange={e => setAvailSettings(prev => ({ ...prev, work_hours_start: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Fim</label>
                  <input type="time" value={availSettings.work_hours_end}
                    onChange={e => setAvailSettings(prev => ({ ...prev, work_hours_end: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Duração padrão</label>
                  <select value={availSettings.slot_duration_minutes}
                    onChange={e => setAvailSettings(prev => ({ ...prev, slot_duration_minutes: Number(e.target.value) }))}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm">
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1h30</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Intervalo entre consultas</label>
                  <select value={availSettings.buffer_minutes}
                    onChange={e => setAvailSettings(prev => ({ ...prev, buffer_minutes: Number(e.target.value) }))}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm">
                    <option value={0}>Sem intervalo</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                  </select>
                </div>
              </div>

              {/* Default meeting link */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Link padrão de videochamada</label>
                <input value={availSettings.default_meeting_link}
                  onChange={e => setAvailSettings(prev => ({ ...prev, default_meeting_link: e.target.value }))}
                  placeholder="https://meet.google.com/seu-link..."
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
                <p className="text-xs text-slate-600 mt-1">Preenchido automaticamente ao agendar consultas online</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSettings(false)} className="border-slate-600 text-slate-400">Cancelar</Button>
                <Button onClick={saveAvailability} disabled={savingSettings} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                  {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar disponibilidade
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    {appt.patient?.user_id && (
                      <button onClick={() => openRelatorio(appt)}
                        className="p-2 rounded-lg hover:bg-slate-700 text-violet-400 hover:text-violet-300 transition-colors" title="Relatório pré-consulta">
                        <FileText size={16} />
                      </button>
                    )}
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

      {/* Modal: Relatório Pré-Consulta */}
      <AnimatePresence>
        {relatorioAppt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setRelatorioAppt(null)}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-bold text-base flex items-center gap-2">
                    <FileText size={16} className="text-violet-400" />
                    Relatório Pré-Consulta
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">{relatorioAppt.patient?.name}</p>
                </div>
                <button onClick={() => setRelatorioAppt(null)} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {loadingRelatorio ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-indigo-400" />
                </div>
              ) : !relatorio ? (
                <div className="text-center py-8">
                  <Sparkles size={28} className="text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm mb-4">Nenhum relatório gerado ainda para esta consulta.</p>
                  <button onClick={gerarRelatorio} disabled={gerandoRelatorio}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                    {gerandoRelatorio ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Gerar relatório (últimos 30 dias)
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Período: {relatorio.periodo_inicio} a {relatorio.periodo_fim}
                    </p>
                    <p className="text-white text-sm">
                      Adesão alimentar: <span className="font-bold">{relatorio.dados_json.adesao.taxa_percentual}%</span>
                      <span className="text-slate-500"> ({relatorio.dados_json.adesao.dias_com_registro}/{relatorio.dados_json.adesao.total_dias} dias)</span>
                    </p>
                    {relatorio.dados_json.paciente.fase_atual && (
                      <p className="text-slate-400 text-xs">Fase atual: {relatorio.dados_json.paciente.fase_atual}</p>
                    )}
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Análise clínica (IA)</p>
                    <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{relatorio.analise_clinica}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button onClick={gerarRelatorio} disabled={gerandoRelatorio}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50">
                      {gerandoRelatorio ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Atualizar
                    </button>
                    <button onClick={exportarRelatorio}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all">
                      <FileDown size={14} />
                      Exportar PDF
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
