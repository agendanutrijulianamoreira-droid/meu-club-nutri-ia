"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, Star, Video, MapPin, Clock, Loader2, Calendar, Heart, Filter, ArrowRight, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"

interface Professional {
  id: string; name: string; photo_url: string; bio: string;
  profession: string; specialty: string; is_virtual: boolean; is_in_person: boolean;
  price_cents: number; price_display: string; rating: number; total_sessions: number;
  is_featured: boolean; duration_minutes: number;
}

interface Booking {
  id: string; scheduled_at: string; status: string; price_cents: number;
  professional: { name: string; profession: string; specialty: string; photo_url: string; meeting_link: string }
}

const PROFESSION_LABELS: Record<string, { label: string; emoji: string }> = {
  nutricionista: { label: 'Nutrição', emoji: '🥗' },
  psicologo: { label: 'Psicologia', emoji: '🧠' },
  personal: { label: 'Esportivo', emoji: '💪' },
  medico: { label: 'Medicina', emoji: '⚕️' },
  fisioterapeuta: { label: 'Fisioterapia', emoji: '🦴' },
  outro: { label: 'Outros', emoji: '👤' },
}

export default function PatientProfessionalsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'browse' | 'bookings'>('browse')
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)
  const [selectedProf, setSelectedProf] = useState<Professional | null>(null)
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { loadProfessionals() }, [filter])
  useEffect(() => { if (tab === 'bookings') loadBookings() }, [tab])

  const loadProfessionals = async () => {
    setLoading(true)
    const params = filter ? `?profession=${filter}` : ''
    const res = await fetch(`/api/patient/professionals${params}`)
    const data = await res.json()
    setProfessionals(data.professionals || [])
    setLoading(false)
  }

  const loadBookings = async () => {
    setLoading(true)
    const res = await fetch('/api/patient/professionals?my_bookings=true')
    const data = await res.json()
    setBookings(data.bookings || [])
    setLoading(false)
  }

  const handleBook = async () => {
    if (!selectedProf || !bookingDate || !bookingTime) return
    setSubmitting(true)
    try {
      const scheduledAt = `${bookingDate}T${bookingTime}:00-03:00`
      const res = await fetch('/api/patient/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ professional_id: selectedProf.id, scheduled_at: scheduledAt, patient_notes: bookingNotes }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setToast('Consulta agendada! Aguardando confirmação.')
      setSelectedProf(null); setBookingDate(''); setBookingTime(''); setBookingNotes('')
      setTimeout(() => setToast(null), 4000)
    } catch (err: any) {
      setToast(err.message || 'Erro ao agendar')
      setTimeout(() => setToast(null), 4000)
    } finally { setSubmitting(false) }
  }

  const cancelBooking = async (id: string) => {
    await fetch('/api/patient/professionals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: id, action: 'cancel' }),
    })
    loadBookings()
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending: { label: 'Aguardando', color: 'text-amber-400 bg-amber-500/10' },
    confirmed: { label: 'Confirmada', color: 'text-emerald-400 bg-emerald-500/10' },
    completed: { label: 'Realizada', color: 'text-slate-400 bg-slate-500/10' },
    cancelled_patient: { label: 'Cancelada', color: 'text-rose-400 bg-rose-500/10' },
    cancelled_professional: { label: 'Cancelada pelo prof.', color: 'text-rose-400 bg-rose-500/10' },
    no_show: { label: 'Não compareceu', color: 'text-orange-400 bg-orange-500/10' },
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white pb-24">
      {/* Toast */}
      <AnimatePresence>{toast && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="fixed top-4 left-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium bg-indigo-600 text-white text-center">{toast}</motion.div>
      )}</AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 p-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center"><ChevronLeft size={20} /></button>
          <div>
            <h1 className="text-xl font-bold">Profissionais</h1>
            <p className="text-xs text-slate-400">Agende consultas com especialistas</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          <button onClick={() => setTab('browse')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'browse' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}>Encontrar</button>
          <button onClick={() => setTab('bookings')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'bookings' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}>Minhas consultas</button>
        </div>
      </div>

      <main className="p-6 max-w-lg mx-auto">
        {/* TAB: Browse */}
        {tab === 'browse' && !selectedProf && (
          <>
            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-4 -mx-2 px-2">
              <button onClick={() => setFilter(null)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium ${!filter ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}>Todos</button>
              {Object.entries(PROFESSION_LABELS).map(([k, v]) => (
                <button key={k} onClick={() => setFilter(k)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1 ${filter === k ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}>
                  {v.emoji} {v.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
            ) : professionals.length === 0 ? (
              <div className="text-center py-16"><Heart size={48} className="mx-auto text-slate-600 mb-4" /><p className="text-slate-400">Nenhum profissional disponível ainda.</p></div>
            ) : (
              <div className="space-y-4">
                {professionals.map((p, i) => {
                  const meta = PROFESSION_LABELS[p.profession]
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedProf(p)}
                      className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-indigo-500/30 cursor-pointer transition-all">
                      <div className="flex items-start gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl shrink-0">
                          {meta?.emoji || '👤'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-semibold text-sm">{p.name}</h3>
                            {p.is_featured && <Star size={12} className="text-amber-400 fill-amber-400" />}
                          </div>
                          <p className="text-xs text-slate-400">{meta?.label} {p.specialty ? `· ${p.specialty}` : ''}</p>
                          {p.bio && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.bio}</p>}
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                            <span className="text-emerald-400 font-bold text-sm">{p.price_display}</span>
                            <span className="flex items-center gap-1"><Clock size={10} />{p.duration_minutes}min</span>
                            {p.is_virtual && <span className="flex items-center gap-1"><Video size={10} />Online</span>}
                            {p.is_in_person && <span className="flex items-center gap-1"><MapPin size={10} />Presencial</span>}
                            {p.rating > 0 && <span className="flex items-center gap-1"><Star size={10} className="text-amber-400" />{p.rating.toFixed(1)} ({p.total_sessions})</span>}
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-slate-600 shrink-0 mt-4" />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* TAB: Browse — Booking form (selected professional) */}
        {tab === 'browse' && selectedProf && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <button onClick={() => setSelectedProf(null)} className="text-sm text-indigo-400 flex items-center gap-1"><ChevronLeft size={14} />Voltar</button>

            {/* Profile card */}
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] text-center">
              <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center text-4xl mx-auto mb-3">
                {PROFESSION_LABELS[selectedProf.profession]?.emoji || '👤'}
              </div>
              <h2 className="text-lg font-bold text-white">{selectedProf.name}</h2>
              <p className="text-sm text-slate-400">{PROFESSION_LABELS[selectedProf.profession]?.label} {selectedProf.specialty ? `· ${selectedProf.specialty}` : ''}</p>
              {selectedProf.bio && <p className="text-xs text-slate-500 mt-2">{selectedProf.bio}</p>}
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-500">
                <span className="text-emerald-400 font-bold text-lg">{selectedProf.price_display}</span>
                <span className="flex items-center gap-1"><Clock size={12} />{selectedProf.duration_minutes}min</span>
                {selectedProf.rating > 0 && <span className="flex items-center gap-1"><Star size={12} className="text-amber-400" />{selectedProf.rating.toFixed(1)}</span>}
              </div>
            </div>

            {/* Booking form */}
            <div className="space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><Calendar size={16} className="text-indigo-400" />Escolha data e horário</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Data</label>
                  <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Horário</label>
                  <input type="time" value={bookingTime} onChange={e => setBookingTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Observações (opcional)</label>
                <textarea value={bookingNotes} onChange={e => setBookingNotes(e.target.value)} rows={2}
                  placeholder="Ex: Quero focar em ansiedade e compulsão alimentar..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm resize-none" />
              </div>
              <Button onClick={handleBook} disabled={submitting || !bookingDate || !bookingTime}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl gap-2 text-base">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
                Agendar por {selectedProf.price_display}
              </Button>
            </div>
          </motion.div>
        )}

        {/* TAB: My Bookings */}
        {tab === 'bookings' && (
          <>
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-16"><Calendar size={48} className="mx-auto text-slate-600 mb-4" /><p className="text-slate-400">Nenhuma consulta agendada.</p>
                <Button onClick={() => setTab('browse')} className="mt-4 bg-indigo-600 text-white">Encontrar profissional</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b, i) => {
                  const status = STATUS_MAP[b.status] || STATUS_MAP.pending
                  const isUpcoming = new Date(b.scheduled_at) > new Date() && !b.status.startsWith('cancelled')
                  return (
                    <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-lg">
                            {PROFESSION_LABELS[b.professional?.profession]?.emoji || '👤'}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white">{b.professional?.name}</h4>
                            <p className="text-xs text-slate-500">{b.professional?.specialty}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>{status.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>{formatDate(b.scheduled_at)} às {formatTime(b.scheduled_at)}</span>
                        <span className="text-emerald-400">R$ {(b.price_cents / 100).toFixed(2)}</span>
                      </div>
                      {isUpcoming && b.status !== 'completed' && (
                        <div className="mt-3 flex gap-2">
                          {b.professional?.meeting_link && (
                            <a href={b.professional.meeting_link} target="_blank" rel="noopener noreferrer"
                              className="flex-1 text-center py-2 rounded-xl bg-indigo-600/20 text-indigo-400 text-xs font-medium">Entrar na reunião</a>
                          )}
                          <button onClick={() => cancelBooking(b.id)}
                            className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-medium">Cancelar</button>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
