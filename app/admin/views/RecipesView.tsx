"use client"
import React, { useState, useEffect, useCallback } from "react"
import {
  ChefHat, Plus, Sparkles, Loader2, X, Check, AlertCircle,
  Trash2, Edit3, Search, Filter, Clock, Users, Star,
  Leaf, Wheat, Milk, ToggleLeft, ToggleRight, Lock, Unlock
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Ingredient { item: string; quantity: string; note?: string }
interface Substitution { ingredient: string; substitute: string; reason: string }

interface Recipe {
  id: string
  title: string
  description: string | null
  emoji: string
  category: string
  dietary_tags: string[]
  prep_time_min: number | null
  servings: number
  ingredients: Ingredient[]
  instructions: string
  substitutions: Substitution[]
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  access_tier: 'basic' | 'premium'
  is_ai_generated: boolean
  is_active: boolean
}

const CATEGORIES = ['café da manhã', 'lanche', 'almoço', 'jantar', 'sobremesa', 'shot', 'bebida', 'refeição']

const DIETARY_TAGS = [
  { value: 'lactose',   label: 'Sem lactose', icon: <Milk size={11}/> },
  { value: 'gluten',    label: 'Sem glúten',  icon: <Wheat size={11}/> },
  { value: 'vegana',    label: 'Vegana',       icon: <Leaf size={11}/> },
  { value: 'vegetariana', label: 'Vegetariana', icon: <Leaf size={11}/> },
  { value: 'low_carb',  label: 'Low Carb',    icon: null },
  { value: 'sem_acucar',label: 'Sem açúcar',  icon: null },
]

const CAT_EMOJI: Record<string, string> = {
  'café da manhã': '🌅', 'lanche': '🍎', 'almoço': '☀️',
  'jantar': '🌙', 'sobremesa': '🍮', 'shot': '⚡', 'bebida': '🥤', 'refeição': '🍽️',
}

// ─── Formulário IA ────────────────────────────────────────────────────────────
function AIGenerateForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [theme, setTheme] = useState('')
  const [category, setCategory] = useState('refeição')
  const [tags, setTags] = useState<string[]>([])
  const [tier, setTier] = useState<'basic' | 'premium'>('basic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleTag = (t: string) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const handleGenerate = async () => {
    if (!theme.trim()) { setError('Digite um tema para a receita'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ai', theme, category, dietary_tags: tags, access_tier: tier }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Erro'); return }
      onSaved()
    } catch { setError('Erro ao gerar receita') }
    finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-indigo-500/10 border border-indigo-500/25 rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-400"/>
          <p className="text-sm font-bold text-white">Gerar Receita com IA</p>
        </div>
        <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors"><X size={16}/></button>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Tema da receita</label>
        <input value={theme} onChange={e => setTheme(e.target.value)}
          placeholder="Ex: frango grelhado anti-inflamatório, smoothie detox, omelete fit..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"/>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Categoria</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_EMOJI[c]} {c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Plano</label>
          <div className="flex gap-2">
            {(['basic', 'premium'] as const).map(t => (
              <button key={t} onClick={() => setTier(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                  tier === t ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                }`}>
                {t === 'premium' ? <Lock size={11}/> : <Unlock size={11}/>}
                {t === 'basic' ? 'Básico' : 'Premium'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Restrições alimentares</label>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_TAGS.map(tag => (
            <button key={tag.value} onClick={() => toggleTag(tag.value)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-medium transition-all ${
                tags.includes(tag.value) ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'
              }`}>
              {tag.icon} {tag.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="flex items-center gap-1.5 text-sm text-rose-400"><AlertCircle size={13}/> {error}</p>}

      <button onClick={handleGenerate} disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
        {loading ? <><Loader2 size={15} className="animate-spin"/> Gerando receita completa…</> : <><Sparkles size={15}/> Gerar Receita</>}
      </button>
    </motion.div>
  )
}

// ─── Card de receita ──────────────────────────────────────────────────────────
function RecipeCard({ recipe, onEdit, onDelete, onToggle }: {
  recipe: Recipe
  onEdit: (r: Recipe) => void
  onDelete: (id: string) => void
  onToggle: (id: string, active: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-white/5 border rounded-3xl overflow-hidden group transition-all hover:border-indigo-500/20 ${
        recipe.is_active ? 'border-white/10' : 'border-white/5 opacity-60'
      }`}>
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">{recipe.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[9px] font-black uppercase text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                {CAT_EMOJI[recipe.category]} {recipe.category}
              </span>
              {recipe.access_tier === 'premium' && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center gap-1">
                  <Lock size={9}/> Premium
                </span>
              )}
              {recipe.is_ai_generated && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex items-center gap-1">
                  <Sparkles size={9}/> IA
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-white">{recipe.title}</p>
            {recipe.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{recipe.description}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onToggle(recipe.id, !recipe.is_active)}
              className={`p-1.5 rounded-xl transition-all ${recipe.is_active ? 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10' : 'text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10'}`}>
              {recipe.is_active ? <ToggleRight size={13}/> : <ToggleLeft size={13}/>}
            </button>
            <button onClick={() => onDelete(recipe.id)}
              className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
              <Trash2 size={13}/>
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-3">
          {recipe.prep_time_min && <span className="flex items-center gap-1"><Clock size={10}/> {recipe.prep_time_min}min</span>}
          <span className="flex items-center gap-1"><Users size={10}/> {recipe.servings} porção{recipe.servings !== 1 ? 'ões' : ''}</span>
          {recipe.calories && <span>🔥 {recipe.calories} kcal</span>}
        </div>

        {/* Tags */}
        {recipe.dietary_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.dietary_tags.map(t => (
              <span key={t} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{t}</span>
            ))}
          </div>
        )}

        {/* Expand */}
        <button onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
          {expanded ? '▲ Recolher' : '▼ Ver receita completa'}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="pt-3 space-y-3">
                {recipe.ingredients?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Ingredientes</p>
                    <ul className="space-y-1">
                      {recipe.ingredients.map((ing, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="text-slate-600 shrink-0">•</span>
                          <span><span className="font-medium">{ing.quantity}</span> {ing.item}{ing.note ? <span className="text-slate-500"> ({ing.note})</span> : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {recipe.instructions && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Preparo</p>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{recipe.instructions}</p>
                  </div>
                )}
                {recipe.substitutions?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Substituições</p>
                    {recipe.substitutions.map((s, i) => (
                      <p key={i} className="text-xs text-slate-400">
                        <span className="font-medium text-white">{s.ingredient}</span> → {s.substitute}
                        {s.reason ? <span className="text-slate-600"> ({s.reason})</span> : ''}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── View principal ───────────────────────────────────────────────────────────
export function RecipesView({ setView, tenantId = '' }: {
  setView: (v: any) => void; tenantId?: string
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'ai-generate'>('list')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCat) params.set('category', filterCat)
      if (filterTag) params.set('tag', filterTag)
      const res = await fetch(`/api/admin/recipes?${params}`)
      const data = await res.json()
      setRecipes(data.recipes || [])
    } catch { showToast('error', 'Erro ao carregar receitas') }
    finally { setLoading(false) }
  }, [filterCat, filterTag])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Desativar esta receita?')) return
    await fetch('/api/admin/recipes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load(); showToast('success', 'Receita desativada')
  }

  const handleToggle = async (id: string, active: boolean) => {
    await fetch('/api/admin/recipes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: active }) })
    load()
  }

  const filtered = recipes.filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase()))
  const aiCount = recipes.filter(r => r.is_ai_generated).length
  const premiumCount = recipes.filter(r => r.access_tier === 'premium').length

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">Receitas <span className="font-bold">do Clube</span></h1>
          <p className="text-slate-400 text-sm mt-1">Banco de receitas geradas por IA ou criadas por você</p>
        </div>
        <button onClick={() => setMode(mode === 'ai-generate' ? 'list' : 'ai-generate')}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all shrink-0">
          {mode === 'ai-generate' ? <><X size={14}/> Cancelar</> : <><Sparkles size={14}/> Gerar com IA</>}
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/25 text-rose-400'}`}>
            {toast.type === 'success' ? <Check size={15}/> : <AlertCircle size={15}/>} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: recipes.length, icon: '🍽️' },
          { label: 'Geradas por IA', value: aiCount, icon: '✨' },
          { label: 'Premium', value: premiumCount, icon: '🔒' },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-lg mb-0.5">{s.icon}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Formulário IA */}
      <AnimatePresence mode="wait">
        {mode === 'ai-generate' && (
          <AIGenerateForm key="ai-form"
            onSaved={() => { setMode('list'); load(); showToast('success', 'Receita gerada!') }}
            onCancel={() => setMode('list')}/>
        )}
      </AnimatePresence>

      {/* Filtros */}
      {mode === 'list' && (
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar receitas..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/40"/>
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">Todas categorias</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_EMOJI[c]} {c}</option>)}
          </select>
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">Todas restrições</option>
            {DIETARY_TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-600"/></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
          <ChefHat size={40} className="text-slate-700 mx-auto mb-3"/>
          <p className="text-slate-400 font-medium mb-1">Nenhuma receita ainda</p>
          <p className="text-slate-600 text-sm mb-5">Use a IA para gerar receitas completas com ingredientes, modo de preparo e substituições</p>
          <button onClick={() => setMode('ai-generate')}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all mx-auto">
            <Sparkles size={14}/> Gerar primeira receita
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {filtered.map(r => (
              <RecipeCard key={r.id} recipe={r} onEdit={() => {}} onDelete={handleDelete} onToggle={handleToggle}/>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
