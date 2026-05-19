"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ShoppingBag, ExternalLink, Zap, Eye, EyeOff, Edit2, Trash2,
  Plus, Loader2, ArrowUpRight, Package, Calendar,
  Dna, X
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface GatewayProduct {
  id: string
  name: string
  description?: string
  short_pitch?: string
  product_type: 'consultation' | 'program_90d' | 'genetic_test' | 'custom'
  price_label?: string
  cta_text: string
  external_url?: string
  badge_text?: string
  trigger_type: 'manual' | 'after_days' | 'after_checkins' | 'high_engagement'
  trigger_value?: number
  visible_to_plans: string[]
  display_order: number
  is_active: boolean
}

const TYPE_META = {
  consultation: { label: 'Consulta', icon: Calendar, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  program_90d: { label: 'Método 90 Dias', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  genetic_test: { label: 'Teste Genético', icon: Dna, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  custom: { label: 'Personalizado', icon: Package, color: 'text-slate-400', bg: 'bg-white/5 border-white/10' },
} as const

const TRIGGER_META = {
  manual: { label: 'Sempre visível', desc: 'Aparece para todas no plano selecionado' },
  after_days: { label: 'Após X dias no clube', desc: 'Aparece depois de N dias desde o cadastro' },
  after_checkins: { label: 'Após X check-ins', desc: 'Aparece após a paciente completar N check-ins' },
  high_engagement: { label: 'Streak alto', desc: 'Aparece quando a paciente tem N+ dias de streak' },
} as const

const PLANS = ['community', 'tech_diet', 'vip'] as const
const PLAN_LABELS: Record<string, string> = { community: 'Comunidade (Free)', tech_diet: 'Tech Diet', vip: 'VIP Premium' }

const EMPTY_FORM: Omit<GatewayProduct, 'id'> = {
  name: '',
  description: '',
  short_pitch: '',
  product_type: 'consultation',
  price_label: '',
  cta_text: 'Quero saber mais',
  external_url: '',
  badge_text: '',
  trigger_type: 'manual',
  trigger_value: undefined,
  visible_to_plans: ['community', 'tech_diet'],
  display_order: 0,
  is_active: true,
}

export function ProductGatewayView({ setView, tenantId }: { setView: (v: any) => void; tenantId?: string }) {
  const [products, setProducts] = useState<GatewayProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<GatewayProduct, 'id'>>(EMPTY_FORM)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/gateway-products')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch { setProducts([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, display_order: products.length })
    setShowModal(true)
  }

  const openEdit = (p: GatewayProduct) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description ?? '',
      short_pitch: p.short_pitch ?? '',
      product_type: p.product_type,
      price_label: p.price_label ?? '',
      cta_text: p.cta_text,
      external_url: p.external_url ?? '',
      badge_text: p.badge_text ?? '',
      trigger_type: p.trigger_type,
      trigger_value: p.trigger_value,
      visible_to_plans: p.visible_to_plans,
      display_order: p.display_order,
      is_active: p.is_active,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return showToast('error', 'Nome é obrigatório')
    setSaving(true)
    try {
      const url = editingId ? `/api/admin/gateway-products/${editingId}` : '/api/admin/gateway-products'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error()
      showToast('success', editingId ? 'Produto atualizado!' : 'Produto criado!')
      setShowModal(false)
      load()
    } catch { showToast('error', 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const handleToggle = async (p: GatewayProduct) => {
    const res = await fetch(`/api/admin/gateway-products/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active })
    })
    if (res.ok) setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este produto?')) return
    setDeleting(id)
    const res = await fetch(`/api/admin/gateway-products/${id}`, { method: 'DELETE' })
    if (res.ok) setProducts(prev => prev.filter(x => x.id !== id))
    else showToast('error', 'Erro ao remover')
    setDeleting(null)
  }

  const togglePlan = (plan: string) => {
    setForm(f => ({
      ...f,
      visible_to_plans: f.visible_to_plans.includes(plan)
        ? f.visible_to_plans.filter(p => p !== plan)
        : [...f.visible_to_plans, plan]
    }))
  }

  const active = products.filter(p => p.is_active).length

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light text-white">Produtos &amp; <span className="font-bold">Gateway</span></h1>
          <p className="text-slate-400 text-sm mt-1">Configure ofertas de upsell para guiar suas clientes aos próximos passos</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium border ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Produtos', value: products.length, color: 'text-indigo-400' },
          { label: 'Ativos', value: active, color: 'text-emerald-400' },
          { label: 'Inativos', value: products.length - active, color: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-3xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
          <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">Nenhum produto configurado</p>
          <p className="text-slate-500 text-sm mb-6">Adicione consultas, programas ou testes que você oferece</p>
          <button onClick={openCreate}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
            Criar primeiro produto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {products.map(p => {
            const meta = TYPE_META[p.product_type]
            const Icon = meta.icon
            return (
              <motion.div key={p.id} layout
                className={`bg-white/5 border border-white/10 rounded-3xl p-5 transition-all ${!p.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${meta.bg}`}>
                      <Icon className={`w-5 h-5 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold">{p.name}</span>
                        {p.badge_text && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/25 text-amber-400">
                            {p.badge_text}
                          </span>
                        )}
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      {p.short_pitch && <p className="text-slate-400 text-sm mt-0.5">{p.short_pitch}</p>}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {p.price_label && (
                          <span className="text-emerald-400 text-sm font-bold">{p.price_label}</span>
                        )}
                        <span className="text-slate-600 text-xs">
                          {TRIGGER_META[p.trigger_type].label}
                          {p.trigger_value ? ` (${p.trigger_value})` : ''}
                        </span>
                        <span className="text-slate-600 text-xs">
                          {p.visible_to_plans.map(pl => PLAN_LABELS[pl]).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {p.external_url && (
                      <a href={p.external_url} target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => handleToggle(p)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all">
                      {p.is_active ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(p)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-xl hover:bg-white/5 transition-all">
                      {deleting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Type */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Tipo de produto</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(TYPE_META) as [keyof typeof TYPE_META, typeof TYPE_META[keyof typeof TYPE_META]][]).map(([key, m]) => {
                      const Ic = m.icon
                      return (
                        <button key={key} onClick={() => setForm(f => ({ ...f, product_type: key }))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border text-sm font-medium transition-all ${form.product_type === key ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'}`}>
                          <Ic className={`w-4 h-4 ${m.color}`} />
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Nome do produto *</p>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Consulta Nutricional Personalizada"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                </div>

                {/* Short pitch */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Pitch curto (para a paciente)</p>
                  <input value={form.short_pitch ?? ''} onChange={e => setForm(f => ({ ...f, short_pitch: e.target.value }))}
                    placeholder="Ex: Consulta 1:1 para resultado mais rápido"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                </div>

                {/* Description */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Descrição completa</p>
                  <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="O que a cliente vai receber com esse produto..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Price */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Preço (exibição)</p>
                    <input value={form.price_label ?? ''} onChange={e => setForm(f => ({ ...f, price_label: e.target.value }))}
                      placeholder="R$ 297"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                  </div>
                  {/* Badge */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Badge (opcional)</p>
                    <input value={form.badge_text ?? ''} onChange={e => setForm(f => ({ ...f, badge_text: e.target.value }))}
                      placeholder="MAIS POPULAR"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                  </div>
                </div>

                {/* CTA & URL */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Texto do botão</p>
                  <input value={form.cta_text} onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))}
                    placeholder="Quero saber mais"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Link destino (URL)</p>
                  <input value={form.external_url ?? ''} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                </div>

                {/* Trigger */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Quando mostrar</p>
                  <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value as GatewayProduct['trigger_type'] }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50">
                    {(Object.entries(TRIGGER_META) as [keyof typeof TRIGGER_META, typeof TRIGGER_META[keyof typeof TRIGGER_META]][]).map(([k, m]) => (
                      <option key={k} value={k} className="bg-slate-900">{m.label}</option>
                    ))}
                  </select>
                  {form.trigger_type !== 'manual' && (
                    <div className="mt-2">
                      <input type="number" value={form.trigger_value ?? ''} onChange={e => setForm(f => ({ ...f, trigger_value: Number(e.target.value) }))}
                        placeholder="Número de dias / check-ins / streak"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                    </div>
                  )}
                  <p className="text-slate-600 text-xs mt-1">{TRIGGER_META[form.trigger_type].desc}</p>
                </div>

                {/* Plans */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Visível para os planos</p>
                  <div className="flex flex-wrap gap-2">
                    {PLANS.map(plan => (
                      <button key={plan} onClick={() => togglePlan(plan)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${form.visible_to_plans.includes(plan) ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/10 bg-white/5 text-slate-500'}`}>
                        {PLAN_LABELS[plan]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-medium rounded-2xl transition-all">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingId ? 'Salvar' : 'Criar Produto'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
