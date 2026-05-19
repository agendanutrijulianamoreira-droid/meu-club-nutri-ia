"use client"
import React, { useState, useEffect, useCallback } from "react"
import {
  Package, Plus, Edit3, Trash2, Loader2, X, ChevronDown, ChevronUp,
  Sparkles, DollarSign, Users, ToggleLeft, ToggleRight, FlaskConical,
  Dna, CalendarDays, Stethoscope, Star, Check, AlertCircle
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface ContentAccess {
  protocols: boolean
  meal_plans: boolean
  genetic_report: boolean
  consultation_booking: boolean
  community: boolean
  premium_recipes: boolean
}

interface Product {
  id: string
  name: string
  slug: string
  type: 'consultation' | 'method_90d' | 'genetic_test' | 'subscription' | 'custom'
  description: string | null
  short_description: string | null
  price_cents: number
  stripe_price_id: string | null
  payment_type: 'one_time' | 'recurring'
  recurring_interval: string | null
  content_access: ContentAccess
  features: string[]
  badge_text: string | null
  highlight: boolean
  is_active: boolean
  sort_order: number
  active_users: number
}

const TYPE_META = {
  consultation:  { label: 'Consulta',       icon: <Stethoscope size={14}/>, color: 'text-sky-400',     bg: 'bg-sky-500/15 border-sky-500/25' },
  method_90d:   { label: 'Método 90 Dias',  icon: <CalendarDays size={14}/>, color: 'text-indigo-400', bg: 'bg-indigo-500/15 border-indigo-500/25' },
  genetic_test:  { label: 'Teste Genético', icon: <Dna size={14}/>,          color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/25' },
  subscription:  { label: 'Assinatura',     icon: <Star size={14}/>,          color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/25' },
  custom:        { label: 'Personalizado',  icon: <Package size={14}/>,       color: 'text-emerald-400',bg: 'bg-emerald-500/15 border-emerald-500/25' },
}

const ACCESS_LABELS: Record<keyof ContentAccess, string> = {
  protocols:             'Bio-Protocolos',
  meal_plans:            'Cardápios personalizados',
  genetic_report:        'Relatório genético',
  consultation_booking:  'Agendamento de consulta',
  community:             'Comunidade',
  premium_recipes:       'Receitas premium',
}

const DEFAULT_ACCESS: ContentAccess = {
  protocols: false,
  meal_plans: false,
  genetic_report: false,
  consultation_booking: false,
  community: false,
  premium_recipes: false,
}

const DEFAULT_PRODUCTS = [
  {
    name: 'Consulta Individual',
    type: 'consultation' as const,
    short_description: 'Atendimento personalizado 1:1',
    price_cents: 25000,
    payment_type: 'one_time' as const,
    content_access: { ...DEFAULT_ACCESS, consultation_booking: true },
    features: ['Avaliação nutricional completa', 'Plano alimentar personalizado', 'Suporte por 30 dias'],
  },
  {
    name: 'Método 90 Dias',
    type: 'method_90d' as const,
    short_description: 'Transformação completa em 3 meses',
    price_cents: 49700,
    payment_type: 'one_time' as const,
    content_access: { ...DEFAULT_ACCESS, protocols: true, meal_plans: true, community: true, premium_recipes: true },
    features: ['Protocolo sazonal exclusivo', 'Cardápios semanais', 'Comunidade privada', 'Gamificação e desafios'],
  },
  {
    name: 'Teste Genético',
    type: 'genetic_test' as const,
    short_description: 'Nutrição baseada no seu DNA',
    price_cents: 89700,
    payment_type: 'one_time' as const,
    content_access: { ...DEFAULT_ACCESS, genetic_report: true, protocols: true, meal_plans: true },
    features: ['Kit de coleta em casa', 'Relatório genético detalhado', 'Protocolo baseado no DNA', 'Consulta de interpretação'],
  },
]

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

// ─── Formulário de produto ────────────────────────────────────────────────────
function ProductForm({ product, onSave, onCancel }: {
  product?: Product | null; onSave: () => void; onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: product?.name || '',
    type: product?.type || 'custom',
    description: product?.description || '',
    short_description: product?.short_description || '',
    price_cents: product?.price_cents ?? 0,
    stripe_price_id: product?.stripe_price_id || '',
    payment_type: product?.payment_type || 'one_time',
    recurring_interval: product?.recurring_interval || 'month',
    badge_text: product?.badge_text || '',
    highlight: product?.highlight || false,
    features: (product?.features || []).join('\n'),
    content_access: product?.content_access || { ...DEFAULT_ACCESS },
  })
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const setAccess = (k: keyof ContentAccess, v: boolean) =>
    setForm(f => ({ ...f, content_access: { ...f.content_access, [k]: v } }))

  const generateDescription = async () => {
    if (!form.name.trim()) { setError('Digite o nome do produto primeiro'); return }
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'sales-copy',
          context: { productName: form.name, type: form.type, price: formatPrice(form.price_cents) },
        }),
      })
      const data = await res.json()
      if (data.result?.subheadline) set('description', data.result.subheadline)
      if (data.result?.benefits?.length) set('features', data.result.benefits.join('\n'))
    } catch {
      setError('Erro ao gerar descrição')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...(product ? { id: product.id } : {}),
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || null,
        short_description: form.short_description.trim() || null,
        price_cents: Number(form.price_cents) || 0,
        stripe_price_id: form.stripe_price_id.trim() || null,
        payment_type: form.payment_type,
        recurring_interval: form.payment_type === 'recurring' ? form.recurring_interval : null,
        badge_text: form.badge_text.trim() || null,
        highlight: form.highlight,
        features: form.features.split('\n').map(s => s.trim()).filter(Boolean),
        content_access: form.content_access,
      }
      const res = await fetch('/api/admin/products', {
        method: product ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">{product ? 'Editar Produto' : 'Novo Produto'}</p>
        <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
          <X size={18}/>
        </button>
      </div>

      {/* Nome + Tipo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 md:col-span-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Nome do Produto</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Ex: Método 90 Dias"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"/>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Tipo</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
            {Object.entries(TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Descrição curta */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Frase de impacto (exibida no card)</label>
        <input value={form.short_description} onChange={e => set('short_description', e.target.value)}
          placeholder="Ex: Transformação completa em 3 meses"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"/>
      </div>

      {/* Preço + Stripe */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Preço (em centavos)</label>
          <input type="number" value={form.price_cents} onChange={e => set('price_cents', e.target.value)}
            placeholder="9700 = R$97,00"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"/>
          {Number(form.price_cents) > 0 && (
            <p className="text-[11px] text-emerald-400 mt-1">{formatPrice(Number(form.price_cents))}</p>
          )}
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Tipo de cobrança</label>
          <select value={form.payment_type} onChange={e => set('payment_type', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
            <option value="one_time">Pagamento único</option>
            <option value="recurring">Recorrente</option>
          </select>
        </div>
      </div>

      {form.payment_type === 'recurring' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Frequência</label>
            <select value={form.recurring_interval} onChange={e => set('recurring_interval', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
              <option value="month">Mensal</option>
              <option value="year">Anual</option>
            </select>
          </div>
        </div>
      )}

      {/* Stripe Price ID */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Stripe Price ID <span className="text-slate-600">(opcional)</span></label>
        <input value={form.stripe_price_id} onChange={e => set('stripe_price_id', e.target.value)}
          placeholder="price_xxxxxxxxxxxxxxxxxx"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 font-mono text-xs"/>
      </div>

      {/* Acesso ao conteúdo */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-2">O que este produto desbloqueia</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(DEFAULT_ACCESS) as Array<keyof ContentAccess>).map(key => (
            <button key={key} onClick={() => setAccess(key, !form.content_access[key])}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left ${
                form.content_access[key]
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                  : 'bg-white/3 border-white/8 text-slate-500 hover:border-white/15'
              }`}>
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                form.content_access[key] ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'
              }`}>
                {form.content_access[key] && <Check size={10} className="text-white"/>}
              </div>
              {ACCESS_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Benefícios */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Benefícios (um por linha)</label>
          <button onClick={generateDescription} disabled={aiLoading}
            className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors">
            {aiLoading ? <Loader2 size={11} className="animate-spin"/> : <Sparkles size={11}/>}
            Gerar com IA
          </button>
        </div>
        <textarea value={form.features} onChange={e => set('features', e.target.value)} rows={4}
          placeholder={'Avaliação nutricional completa\nPlano alimentar personalizado\nSuportes via WhatsApp'}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"/>
      </div>

      {/* Badge + Destaque */}
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Badge <span className="text-slate-600">(ex: Mais popular)</span></label>
          <input value={form.badge_text} onChange={e => set('badge_text', e.target.value)}
            placeholder="Mais popular"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"/>
        </div>
        <button onClick={() => set('highlight', !form.highlight)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
            form.highlight ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'
          }`}>
          <Star size={14}/> Destaque
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-rose-400">
          <AlertCircle size={14}/> {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
          {saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
          {saving ? 'Salvando…' : 'Salvar Produto'}
        </button>
        <button onClick={onCancel} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium rounded-2xl transition-all">
          Cancelar
        </button>
      </div>
    </motion.div>
  )
}

// ─── Card de produto ──────────────────────────────────────────────────────────
function ProductCard({ product, onEdit, onToggle, onDelete }: {
  product: Product
  onEdit: (p: Product) => void
  onToggle: (p: Product) => void
  onDelete: (id: string) => void
}) {
  const meta = TYPE_META[product.type]
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-white/5 border rounded-3xl p-5 group relative transition-all hover:border-indigo-500/30 ${
        product.is_active ? 'border-white/10' : 'border-white/5 opacity-60'
      }`}>
      {product.highlight && (
        <span className="absolute -top-2.5 left-5 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400">
          Destaque
        </span>
      )}
      {product.badge_text && (
        <span className="absolute -top-2.5 right-5 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
          {product.badge_text}
        </span>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color} flex items-center gap-1`}>
              {meta.icon} {meta.label}
            </span>
          </div>
          <p className="text-base font-bold text-white truncate">{product.name}</p>
          {product.short_description && (
            <p className="text-xs text-slate-400 mt-0.5">{product.short_description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-black text-white">{formatPrice(product.price_cents)}</p>
          <p className="text-[10px] text-slate-500">
            {product.payment_type === 'recurring' ? `por ${product.recurring_interval === 'month' ? 'mês' : 'ano'}` : 'pagamento único'}
          </p>
        </div>
      </div>

      {/* Acessos */}
      {product.content_access && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(Object.entries(product.content_access) as [keyof ContentAccess, boolean][])
            .filter(([, v]) => v)
            .map(([k]) => (
              <span key={k} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                {ACCESS_LABELS[k]}
              </span>
            ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/5">
        <span className="flex items-center gap-1.5">
          <Users size={12}/> {product.active_users} ativa{product.active_users !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(product)}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-indigo-500/15 text-slate-400 hover:text-indigo-400 transition-all">
            <Edit3 size={13}/>
          </button>
          <button onClick={() => onToggle(product)}
            className={`p-1.5 rounded-xl bg-white/5 transition-all ${
              product.is_active ? 'hover:bg-amber-500/15 text-slate-400 hover:text-amber-400' : 'hover:bg-emerald-500/15 text-slate-400 hover:text-emerald-400'
            }`}>
            {product.is_active ? <ToggleRight size={13}/> : <ToggleLeft size={13}/>}
          </button>
          <button onClick={() => onDelete(product.id)}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 transition-all">
            <Trash2 size={13}/>
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── View principal ───────────────────────────────────────────────────────────
export function ProductsView({ setView, tenantId = '' }: {
  setView: (v: any) => void; tenantId?: string
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/products')
      const data = await res.json()
      setProducts(data.products || [])
    } catch {
      showToast('error', 'Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleEdit = (p: Product) => { setEditProduct(p); setShowForm(true) }
  const handleNew = () => { setEditProduct(null); setShowForm(true) }
  const handleFormSave = () => { setShowForm(false); setEditProduct(null); load(); showToast('success', 'Produto salvo!') }
  const handleFormCancel = () => { setShowForm(false); setEditProduct(null) }

  const handleToggle = async (p: Product) => {
    await fetch('/api/admin/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    })
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Desativar este produto? Clientes com acesso ativo não serão afetados.')) return
    await fetch('/api/admin/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
    showToast('success', 'Produto desativado')
  }

  const seedDefaults = async () => {
    setSeeding(true)
    try {
      for (const p of DEFAULT_PRODUCTS) {
        await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
        })
      }
      await load()
      showToast('success', '3 produtos criados como ponto de partida!')
    } catch {
      showToast('error', 'Erro ao criar produtos padrão')
    } finally {
      setSeeding(false)
    }
  }

  const activeProducts = products.filter(p => p.is_active)
  const totalUsers = products.reduce((s, p) => s + p.active_users, 0)

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">
            Catálogo de <span className="font-bold">Produtos</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Porta de entrada para seus programas — consulta, método e teste genético
          </p>
        </div>
        <button onClick={handleNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all shrink-0">
          <Plus size={15}/> Novo Produto
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium ${
              toast.type === 'success' ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/25 text-rose-400'
            }`}>
            {toast.type === 'success' ? <Check size={15}/> : <AlertCircle size={15}/>} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Produtos ativos', value: activeProducts.length, icon: <Package size={16} className="text-indigo-400"/> },
          { label: 'Clientes com acesso', value: totalUsers, icon: <Users size={16} className="text-emerald-400"/> },
          { label: 'Tipos disponíveis', value: new Set(products.map(p => p.type)).size, icon: <FlaskConical size={16} className="text-violet-400"/> },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">{s.icon}<p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{s.label}</p></div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Formulário */}
      <AnimatePresence mode="wait">
        {showForm && (
          <ProductForm key={editProduct?.id || 'new'} product={editProduct} onSave={handleFormSave} onCancel={handleFormCancel}/>
        )}
      </AnimatePresence>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-slate-600"/>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
          <Package size={40} className="text-slate-700 mx-auto mb-3"/>
          <p className="text-slate-400 font-medium mb-1">Nenhum produto cadastrado ainda</p>
          <p className="text-slate-600 text-sm mb-5">Crie seus produtos ou use os modelos prontos como ponto de partida</p>
          <button onClick={seedDefaults} disabled={seeding}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all mx-auto">
            {seeding ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
            {seeding ? 'Criando…' : 'Criar Consulta + Método 90d + Genético'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {products.map(p => (
              <ProductCard key={p.id} product={p} onEdit={handleEdit} onToggle={handleToggle} onDelete={handleDelete}/>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
