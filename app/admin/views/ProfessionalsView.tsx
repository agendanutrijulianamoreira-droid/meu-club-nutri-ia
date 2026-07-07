"use client"

import React, { useState, useEffect } from 'react'
import {
  Users, Plus, Loader2, Edit3, Trash2, Star, DollarSign, Video, MapPin,
  Phone, Mail, Award, ChevronDown, Check, X, Eye, TrendingUp, Wallet, Camera
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { useStorage } from "@/lib/hooks/useStorage"

interface ProfessionalsViewProps { setView: (v: any) => void; tenantId?: string }

interface Availability {
  mon: string[]; tue: string[]; wed: string[]; thu: string[]; fri: string[]; sat: string[]; sun: string[]
}

interface Professional {
  id: string; name: string; email: string; phone: string; photo_url: string; bio: string;
  profession: string; specialty: string; registration_id: string;
  is_virtual: boolean; is_in_person: boolean; meeting_link: string; duration_minutes: number;
  price_cents: number; commission_pct: number; price_display: string;
  is_active: boolean; is_featured: boolean; rating: number; total_sessions: number;
  availability: Availability;
  financials: { total_bookings: number; completed: number; cancelled: number; total_revenue: number; platform_revenue: number; professional_payout: number; pending_payout: number }
}

const PROFESSIONS = [
  { value: 'nutricionista', label: 'Nutricionista', emoji: '🥗' },
  { value: 'psicologo', label: 'Psicólogo(a)', emoji: '🧠' },
  { value: 'personal', label: 'Personal Trainer', emoji: '💪' },
  { value: 'medico', label: 'Médico(a)', emoji: '⚕️' },
  { value: 'fisioterapeuta', label: 'Fisioterapeuta', emoji: '🦴' },
  { value: 'outro', label: 'Outro', emoji: '👤' },
]

const WEEKDAYS: { key: keyof Availability; label: string }[] = [
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
]

const TIME_PRESETS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

const EMPTY_AVAILABILITY: Availability = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }

const cents = (v: number) => `R$ ${(v / 100).toFixed(2)}`

export function ProfessionalsView({ setView, tenantId }: ProfessionalsViewProps) {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Professional | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Form
  const [form, setForm] = useState({ name: '', email: '', phone: '', photo_url: '', bio: '', profession: 'nutricionista', specialty: '', registration_id: '', is_virtual: true, is_in_person: false, meeting_link: '', price_reais: '', commission_pct: '50', duration_minutes: '60', is_featured: false, availability: EMPTY_AVAILABILITY })
  const { uploadImage, uploading: uploadingPhoto } = useStorage()

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const { url, error } = await uploadImage(file, 'professionals')
    if (error) showToast('Erro ao subir foto: ' + error, 'error')
    else if (url) setForm(f => ({ ...f, photo_url: url }))
  }

  const toggleSlot = (day: keyof Availability, time: string) => {
    setForm(f => {
      const current = f.availability[day]
      const next = current.includes(time) ? current.filter(t => t !== time) : [...current, time].sort()
      return { ...f, availability: { ...f.availability, [day]: next } }
    })
  }

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/professionals')
      const data = await res.json()
      setProfessionals(data.professionals || [])
    } catch { showToast('Erro ao carregar', 'error') }
    finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    if (!form.name || !form.profession) { showToast('Nome e profissão obrigatórios', 'error'); return }
    const priceCents = Math.round(parseFloat(form.price_reais || '0') * 100)

    try {
      const payload = { ...form, price_cents: priceCents, commission_pct: parseFloat(form.commission_pct), duration_minutes: parseInt(form.duration_minutes), ...(editing ? { id: editing.id } : {}) }
      const res = await fetch('/api/admin/professionals', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast(editing ? 'Profissional atualizado!' : 'Profissional cadastrado!')
      setShowForm(false); setEditing(null); resetForm(); loadData()
    } catch (err: any) { showToast(err.message, 'error') }
  }

  const resetForm = () => setForm({ name: '', email: '', phone: '', photo_url: '', bio: '', profession: 'nutricionista', specialty: '', registration_id: '', is_virtual: true, is_in_person: false, meeting_link: '', price_reais: '', commission_pct: '50', duration_minutes: '60', is_featured: false, availability: EMPTY_AVAILABILITY })

  const startEdit = (p: Professional) => {
    setEditing(p)
    setForm({ name: p.name, email: p.email || '', phone: p.phone || '', photo_url: p.photo_url || '', bio: p.bio || '', profession: p.profession, specialty: p.specialty || '', registration_id: p.registration_id || '', is_virtual: p.is_virtual, is_in_person: p.is_in_person, meeting_link: p.meeting_link || '', price_reais: (p.price_cents / 100).toFixed(2), commission_pct: p.commission_pct.toString(), duration_minutes: p.duration_minutes.toString(), is_featured: p.is_featured, availability: { ...EMPTY_AVAILABILITY, ...(p.availability || {}) } })
    setShowForm(true)
  }

  const toggleActive = async (p: Professional) => {
    await fetch('/api/admin/professionals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, is_active: !p.is_active }) })
    loadData()
  }

  // Financial summary
  const totalRevenue = professionals.reduce((s, p) => s + p.financials.total_revenue, 0)
  const platformRevenue = professionals.reduce((s, p) => s + p.financials.platform_revenue, 0)
  const pendingPayout = professionals.reduce((s, p) => s + p.financials.pending_payout, 0)
  const totalSessions = professionals.reduce((s, p) => s + p.financials.completed, 0)

  return (
    <div className="space-y-6">
      <AnimatePresence>{toast && (<motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-500/90' : 'bg-rose-500/90'} text-white`}>{toast.msg}</motion.div>)}</AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Users className="text-purple-400" size={28} /> Profissionais</h1>
          <p className="text-slate-400 mt-1">Cadastre nutricionistas, psicólogos e personal trainers para as pacientes</p>
        </div>
        <Button onClick={() => { resetForm(); setEditing(null); setShowForm(!showForm) }} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"><Plus size={16} /> Novo profissional</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-emerald-400" /><span className="text-xs text-slate-500">Receita total</span></div>
          <p className="text-xl font-bold text-white">{cents(totalRevenue)}</p>
        </div>
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-1"><Wallet size={14} className="text-indigo-400" /><span className="text-xs text-slate-500">Sua comissão</span></div>
          <p className="text-xl font-bold text-white">{cents(platformRevenue)}</p>
        </div>
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-amber-400" /><span className="text-xs text-slate-500">Repasse pendente</span></div>
          <p className="text-xl font-bold text-white">{cents(pendingPayout)}</p>
        </div>
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-1"><Award size={14} className="text-teal-400" /><span className="text-xs text-slate-500">Sessões realizadas</span></div>
          <p className="text-xl font-bold text-white">{totalSessions}</p>
        </div>
      </div>

      {/* Form */}
      <AnimatePresence>{showForm && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
          <div className="bg-slate-800/40 rounded-xl border border-indigo-500/30 p-6 space-y-4">
            <h3 className="text-white font-semibold">{editing ? 'Editar' : 'Cadastrar'} profissional</h3>

            {/* Foto */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-slate-700/50 border border-slate-600/50 flex items-center justify-center overflow-hidden shrink-0">
                {form.photo_url
                  ? <img src={form.photo_url} alt={form.name} className="h-full w-full object-cover" />
                  : <Camera size={20} className="text-slate-500" />}
              </div>
              <label className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-lg text-sm text-slate-300 cursor-pointer transition-colors">
                {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                {uploadingPhoto ? 'Enviando...' : 'Foto do profissional'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nome completo *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Profissão *</label>
                <select value={form.profession} onChange={e => setForm({ ...form, profession: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm">
                  {PROFESSIONS.map(p => <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Especialidade</label>
                <input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="Ex: Nutrição esportiva" className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Registro (CRN/CRP/CREF)</label>
                <input value={form.registration_id} onChange={e => setForm({ ...form, registration_id: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Telefone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Bio / Descrição</label>
              <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={2} className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm resize-none" />
            </div>

            {/* Disponibilidade */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Disponibilidade na agenda</label>
              <div className="space-y-2">
                {WEEKDAYS.map(({ key, label }) => (
                  <div key={key} className="flex items-start gap-3">
                    <span className="w-8 text-xs font-semibold text-slate-400 pt-2 shrink-0">{label}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {TIME_PRESETS.map(time => {
                        const active = form.availability[key].includes(time)
                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => toggleSlot(key, time)}
                            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${active ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700'}`}
                          >
                            {time}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Clique nos horários em que o profissional atende. Essa agenda é mostrada às pacientes.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Valor da sessão (R$)</label>
                <input type="number" step="0.01" value={form.price_reais} onChange={e => setForm({ ...form, price_reais: e.target.value })} placeholder="150.00" className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Comissão plataforma (%)</label>
                <input type="number" value={form.commission_pct} onChange={e => setForm({ ...form, commission_pct: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
                {form.price_reais && <p className="text-xs text-slate-500 mt-1">Repasse: R$ {(parseFloat(form.price_reais || '0') * (1 - parseFloat(form.commission_pct) / 100)).toFixed(2)}</p>}
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Duração (min)</label>
                <select value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="30">30 min</option><option value="45">45 min</option><option value="60">1 hora</option><option value="90">1h30</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Formato</label>
                <div className="flex gap-2">
                  <button onClick={() => setForm({ ...form, is_virtual: !form.is_virtual })} className={`flex-1 px-2 py-2 rounded-lg text-xs flex items-center justify-center gap-1 ${form.is_virtual ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400'}`}><Video size={12} />Online</button>
                  <button onClick={() => setForm({ ...form, is_in_person: !form.is_in_person })} className={`flex-1 px-2 py-2 rounded-lg text-xs flex items-center justify-center gap-1 ${form.is_in_person ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400'}`}><MapPin size={12} />Presencial</button>
                </div>
              </div>
            </div>
            {form.is_virtual && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Link padrão (Google Meet/Zoom)</label>
                <input value={form.meeting_link} onChange={e => setForm({ ...form, meeting_link: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            )}
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_featured} onChange={e => setForm({ ...form, is_featured: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm text-slate-400 flex items-center gap-1"><Star size={14} className="text-amber-400" /> Destaque na listagem</span></label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null) }} className="border-slate-600 text-slate-400">Cancelar</Button>
                <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"><Check size={14} /> {editing ? 'Salvar' : 'Cadastrar'}</Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}</AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
      ) : professionals.length === 0 ? (
        <div className="text-center py-16"><Users size={48} className="mx-auto text-slate-600 mb-4" /><p className="text-slate-400">Nenhum profissional cadastrado.</p></div>
      ) : (
        <div className="space-y-3">
          {professionals.map(p => {
            const profMeta = PROFESSIONS.find(x => x.value === p.profession)
            const f = p.financials
            return (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`bg-slate-800/40 rounded-xl border p-5 transition-colors ${p.is_active ? 'border-slate-700/50 hover:border-slate-600/50' : 'border-slate-800/50 opacity-50'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-slate-700/50 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                      {p.photo_url ? <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" /> : (profMeta?.emoji || '👤')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-semibold">{p.name}</h3>
                        {p.is_featured && <Star size={14} className="text-amber-400 fill-amber-400" />}
                        {!p.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">Inativo</span>}
                      </div>
                      <p className="text-sm text-slate-400">{profMeta?.label} {p.specialty ? `· ${p.specialty}` : ''} {p.registration_id ? `· ${p.registration_id}` : ''}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="text-emerald-400 font-semibold">{p.price_display}</span>
                        <span>Comissão: {p.commission_pct}%</span>
                        <span>Repasse: R$ {((p.price_cents * (1 - p.commission_pct / 100)) / 100).toFixed(2)}</span>
                        <span>{p.duration_minutes}min</span>
                        {p.is_virtual && <span className="flex items-center gap-1"><Video size={10} />Online</span>}
                        {p.is_in_person && <span className="flex items-center gap-1"><MapPin size={10} />Presencial</span>}
                        {p.rating > 0 && <span className="flex items-center gap-1"><Star size={10} className="text-amber-400" />{p.rating.toFixed(1)}</span>}
                        <span>{p.total_sessions} sessões</span>
                      </div>
                      {/* Financial row */}
                      {f.total_bookings > 0 && (
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-slate-500">{f.completed} realizadas</span>
                          <span className="text-emerald-400">Receita: {cents(f.total_revenue)}</span>
                          <span className="text-indigo-400">Sua parte: {cents(f.platform_revenue)}</span>
                          {f.pending_payout > 0 && <span className="text-amber-400">Pendente repasse: {cents(f.pending_payout)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-400"><Edit3 size={16} /></button>
                    <button onClick={() => toggleActive(p)} className={`p-2 rounded-lg hover:bg-slate-700 ${p.is_active ? 'text-slate-400 hover:text-rose-400' : 'text-slate-400 hover:text-emerald-400'}`} title={p.is_active ? 'Desativar' : 'Ativar'}>
                      {p.is_active ? <X size={16} /> : <Check size={16} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
