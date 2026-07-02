"use client"

import React, { useState, useEffect, useCallback } from 'react'
import {
  Utensils, Sparkles, Loader2, Plus, Trash2, Search, ChevronDown, ChevronRight,
  Save, Send, Copy, RefreshCw, Target, Flame, Drumstick, Wheat, Droplets,
  Edit3, Check, X, ArrowRight, FileText, Users, AlertCircle
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { MealPlansView } from "./MealPlansView"

interface MealPlanBuilderViewProps {
  setView: (v: any) => void
  tenantId?: string
}

interface Food {
  id: string; name: string; category: string; energy_kcal: number;
  protein_g: number; total_fat_g: number; carbs_g: number; fiber_g: number;
  serving_size_g: number; serving_label: string;
}

interface MealItem {
  id?: string; food_id: string | null; food_name: string; quantity_g: number;
  serving_qty?: number; serving_label?: string;
  calc_kcal: number; calc_protein_g: number; calc_carbs_g: number; calc_fat_g: number; calc_fiber_g: number;
  preparation_notes?: string; substitution_note?: string;
}

interface MealGroup { meal_type: string; meal_label: string; time?: string; items: MealItem[] }
interface DayPlan { day_number: number; day_theme?: string; meals: MealGroup[] }

interface MealPlan {
  id?: string; title: string; description?: string; goal: string; duration_days: number;
  target_kcal: number; target_protein_g: number; target_carbs_g: number; target_fat_g: number;
  status: string; is_ai_generated: boolean; days: DayPlan[];
}

const MEAL_TYPES = [
  { value: 'shot',          label: 'Shot Matinal',    emoji: '🧪', time: '06:30' },
  { value: 'cafe_manha',   label: 'Café da Manhã',   emoji: '☀️', time: '08:30' },
  { value: 'colacao',      label: 'Colação',          emoji: '🍎', time: '10:00' },
  { value: 'almoco',       label: 'Almoço',           emoji: '🍽️', time: '12:00' },
  { value: 'lanche_tarde', label: 'Lanche da Tarde', emoji: '🥤', time: '16:00' },
  { value: 'jantar',       label: 'Jantar',           emoji: '🌙', time: '19:30' },
  { value: 'cha_noturno',  label: 'Chá Noturno',     emoji: '🍵', time: '22:00' },
  // legado — planos antigos
  { value: 'lanche_manha', label: 'Lanche da Manhã', emoji: '🍎', time: '10:00' },
  { value: 'ceia',         label: 'Ceia',             emoji: '😴', time: '21:00' },
]

const GOALS = ['emagrecimento', 'hipertrofia', 'manutenção', 'detox', 'anti-inflamatório', 'intestinal', 'energia']

export function MealPlanBuilderView({ setView, tenantId }: MealPlanBuilderViewProps) {
  // Tabs
  const [tab, setTab] = useState<'generate' | 'plans' | 'approval'>('generate')
  // Generator state
  const [goal, setGoal] = useState('emagrecimento')
  const [planMode, setPlanMode] = useState<'basic' | 'premium'>('premium')
  const [days, setDays] = useState(7)
  const [targetKcal, setTargetKcal] = useState(1600)
  const [targetProtein, setTargetProtein] = useState(100)
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [preferences, setPreferences] = useState('')
  const [generating, setGenerating] = useState(false)
  // Plan state
  const [plan, setPlan] = useState<MealPlan | null>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [activeDay, setActiveDay] = useState(1)
  // Food search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Food[]>([])
  const [searching, setSearching] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load existing plans
  useEffect(() => { if (tab === 'plans') loadPlans() }, [tab])

  const loadPlans = async () => {
    setLoadingPlans(true)
    try {
      const res = await fetch('/api/admin/meal-plans')
      const data = await res.json()
      setPlans(data.plans || [])
    } catch { showToast('Erro ao carregar cardápios', 'error') }
    finally { setLoadingPlans(false) }
  }

  // Generate with AI
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/meal-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, duration_days: days, target_kcal: targetKcal, target_protein_g: targetProtein, restrictions, preferences, plan_mode: planMode }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      // Parse generated data into plan structure
      const generated = data.generated
      const planDays: DayPlan[] = (generated.days || []).map((d: any) => ({
        day_number: d.day_number,
        day_theme: d.day_theme,
        meals: (d.meals || []).map((m: any) => ({
          meal_type: m.meal_type,
          meal_label: m.meal_label,
          time: m.time,
          items: (m.items || []).map((i: any) => ({
            food_id: i.food_id, food_name: i.food_name, quantity_g: i.quantity_g,
            serving_qty: i.serving_qty, serving_label: i.serving_label,
            calc_kcal: i.calc_kcal || 0, calc_protein_g: i.calc_protein_g || 0,
            calc_carbs_g: i.calc_carbs_g || 0, calc_fat_g: i.calc_fat_g || 0, calc_fiber_g: i.calc_fiber_g || 0,
            preparation_notes: i.preparation_notes, substitution_note: i.substitution_note,
          })),
        })),
      }))

      setPlan({
        id: data.meal_plan_id,
        title: generated.title || `Cardápio ${goal}`,
        description: generated.description,
        goal, duration_days: days,
        target_kcal: targetKcal, target_protein_g: targetProtein,
        target_carbs_g: Math.round((targetKcal * 0.45) / 4),
        target_fat_g: Math.round((targetKcal * 0.30) / 9),
        status: 'draft', is_ai_generated: true,
        days: planDays,
      })
      setActiveDay(1)
      showToast(`Cardápio gerado! ${data.items_created} itens criados.`)
    } catch (err: any) {
      showToast(err.message || 'Erro ao gerar', 'error')
    } finally { setGenerating(false) }
  }

  // Food search
  const searchFoods = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/foods?q=${encodeURIComponent(q)}&limit=10`)
      const data = await res.json()
      setSearchResults(data.foods || [])
    } catch { setSearchResults([]) }
    finally { setSearching(false) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchFoods(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchFoods])

  // Calculate day totals
  const getDayTotals = (dayNum: number) => {
    const day = plan?.days.find(d => d.day_number === dayNum)
    if (!day) return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    const allItems = day.meals.flatMap(m => m.items)
    return {
      kcal: Math.round(allItems.reduce((s, i) => s + (i.calc_kcal || 0), 0)),
      protein: Math.round(allItems.reduce((s, i) => s + (i.calc_protein_g || 0), 0)),
      carbs: Math.round(allItems.reduce((s, i) => s + (i.calc_carbs_g || 0), 0)),
      fat: Math.round(allItems.reduce((s, i) => s + (i.calc_fat_g || 0), 0)),
      fiber: Math.round(allItems.reduce((s, i) => s + (i.calc_fiber_g || 0), 0)),
    }
  }

  // Replace food item with one from search
  const replaceItem = (dayNum: number, mealType: string, itemIdx: number, food: Food, quantity_g: number) => {
    if (!plan) return
    const ratio = quantity_g / 100
    const newPlan = { ...plan }
    const day = newPlan.days.find(d => d.day_number === dayNum)
    const meal = day?.meals.find(m => m.meal_type === mealType)
    if (!meal) return

    meal.items[itemIdx] = {
      ...meal.items[itemIdx],
      food_id: food.id,
      food_name: food.name,
      quantity_g,
      serving_label: food.serving_label,
      calc_kcal: Math.round(food.energy_kcal * ratio),
      calc_protein_g: Math.round(food.protein_g * ratio * 10) / 10,
      calc_carbs_g: Math.round(food.carbs_g * ratio * 10) / 10,
      calc_fat_g: Math.round(food.total_fat_g * ratio * 10) / 10,
      calc_fiber_g: Math.round(food.fiber_g * ratio * 10) / 10,
    }
    setPlan({ ...newPlan })
    setEditingItem(null)
    setSearchQuery('')
    setSearchResults([])

    // Persist to DB if plan has ID
    if (plan.id && meal.items[itemIdx].id) {
      fetch('/api/admin/meal-plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: meal.items[itemIdx].id, food_id: food.id, food_name: food.name, quantity_g }),
      }).catch(() => {})
    }
  }

  // Remove item
  const removeItem = (dayNum: number, mealType: string, itemIdx: number) => {
    if (!plan) return
    const newPlan = { ...plan }
    const day = newPlan.days.find(d => d.day_number === dayNum)
    const meal = day?.meals.find(m => m.meal_type === mealType)
    if (!meal) return
    const removed = meal.items.splice(itemIdx, 1)[0]
    setPlan({ ...newPlan })
    if (plan.id && removed.id) {
      fetch(`/api/admin/meal-plans?item_id=${removed.id}`, { method: 'DELETE' }).catch(() => {})
    }
  }

  // Publish plan
  const publishPlan = async () => {
    if (!plan?.id) return
    try {
      await fetch('/api/admin/meal-plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id, status: 'published' }),
      })
      setPlan({ ...plan, status: 'published' })
      showToast('Cardápio publicado!')
    } catch { showToast('Erro ao publicar', 'error') }
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
            <Utensils className="text-amber-400" size={28} />
            Cardápios Inteligentes
          </h1>
          <p className="text-slate-400 mt-1">Gere com IA usando dados reais TACO/TBCA e edite cada item</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg w-fit">
        <button onClick={() => setTab('generate')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'generate' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
          <Sparkles size={14} className="inline mr-2" />Gerar cardápio
        </button>
        <button onClick={() => setTab('plans')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'plans' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
          <FileText size={14} className="inline mr-2" />Meus cardápios
        </button>
        <button onClick={() => setTab('approval')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'approval' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
          <Users size={14} className="inline mr-2" />Aprovação de IA por paciente
        </button>
      </div>

      {/* TAB: Approval queue (per-patient plans generated by agents) */}
      {tab === 'approval' && (
        <MealPlansView setView={setView} tenantId={tenantId} />
      )}

      {/* TAB: Generate */}
      {tab === 'generate' && !plan && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Config panel */}
          <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6 space-y-5">
            <h3 className="text-white font-semibold flex items-center gap-2"><Target size={18} className="text-indigo-400" /> Configurar cardápio</h3>

            {/* Toggle Básico / Premium */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Tipo de cardápio</label>
              <div className="flex gap-1.5 p-1 bg-slate-700/40 rounded-xl w-fit">
                <button onClick={() => setPlanMode('basic')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${planMode === 'basic' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  📋 Qualitativo (Básico)
                </button>
                <button onClick={() => setPlanMode('premium')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${planMode === 'premium' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  ⚡ Calculado (Premium)
                </button>
              </div>
              <p className="text-[10px] text-slate-600 mt-1.5">
                {planMode === 'basic' ? 'Descreve o que comer sem calcular calorias. Ideal para planos iniciais.' : 'Usa tabela TACO/TBCA com calorias, macros e gramas exatos.'}
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Objetivo</label>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(g => (
                  <button key={g} onClick={() => setGoal(g)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${goal === g ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Dias</label>
                <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} min={1} max={30}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              {planMode === 'premium' && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Kcal/dia</label>
                  <input type="number" value={targetKcal} onChange={e => setTargetKcal(Number(e.target.value))} step={100}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              )}
            </div>

            {planMode === 'premium' && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Proteína alvo (g/dia)</label>
                <input type="number" value={targetProtein} onChange={e => setTargetProtein(Number(e.target.value))}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Restrições</label>
              <div className="flex flex-wrap gap-2">
                {['lactose', 'gluten', 'vegano', 'vegetariano', 'ovo', 'frutos do mar', 'soja', 'amendoim'].map(r => (
                  <button key={r} onClick={() => setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                    className={`px-3 py-1 rounded-full text-xs transition-all ${restrictions.includes(r) ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent hover:text-white'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Preferências (opcional)</label>
              <textarea value={preferences} onChange={e => setPreferences(e.target.value)} rows={2} placeholder="Ex: priorizar alimentos baratos, incluir receitas simples, evitar repetir frango..."
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm resize-none" />
            </div>

            <Button onClick={handleGenerate} disabled={generating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl gap-2">
              {generating ? <><Loader2 size={18} className="animate-spin" /> Gerando com IA (pode demorar 30s)...</> : planMode === 'basic' ? <><Sparkles size={18} /> Gerar cardápio qualitativo</> : <><Sparkles size={18} /> Gerar cardápio com TACO/TBCA</>}
            </Button>
          </div>

          {/* Info panel */}
          <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6 space-y-4">
            <h3 className="text-white font-semibold flex items-center gap-2"><AlertCircle size={18} className="text-amber-400" /> Como funciona</h3>
            <div className="space-y-3 text-sm text-slate-400">
              <p>A IA recebe a <span className="text-amber-400 font-medium">base completa de alimentos TACO/TBCA</span> (68+ alimentos com dados nutricionais reais) e gera um cardápio usando apenas alimentos dessa base.</p>
              <p>Cada item tem valores de <span className="text-teal-400 font-medium">kcal, proteína, carbs e gordura calculados</span> com base na quantidade em gramas vs os valores por 100g da tabela.</p>
              <p>Após gerar, você pode <span className="text-indigo-400 font-medium">editar cada item</span>: trocar o alimento (busca TACO), ajustar quantidade, adicionar notas de preparo ou sugestões de substituição.</p>
              <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
                <p className="text-white font-medium text-xs mb-1">Fontes de dados:</p>
                <p className="text-xs text-slate-500">TACO 4ª edição (NEPA/UNICAMP) — 597 alimentos</p>
                <p className="text-xs text-slate-500">TBCA (USP) — complementar para itens não cobertos pela TACO</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Generate — Plan Editor (after generation) */}
      {tab === 'generate' && plan && (
        <div className="space-y-4">
          {/* Plan header */}
          <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-white">{plan.title}</h2>
                {plan.description && <p className="text-sm text-slate-400 mt-1">{plan.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${plan.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {plan.status === 'published' ? 'Publicado' : 'Rascunho'}
                </span>
                <Button onClick={() => setPlan(null)} variant="outline" size="sm" className="border-slate-600 text-slate-400">
                  <Plus size={14} className="mr-1" /> Novo
                </Button>
                {plan.status === 'draft' && (
                  <Button onClick={publishPlan} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Send size={14} className="mr-1" /> Publicar
                  </Button>
                )}
              </div>
            </div>
            {/* Targets */}
            <div className="flex gap-4 text-xs">
              <span className="text-slate-500 flex items-center gap-1"><Flame size={12} className="text-orange-400" /> Meta: {plan.target_kcal} kcal</span>
              <span className="text-slate-500 flex items-center gap-1"><Drumstick size={12} className="text-rose-400" /> P: {plan.target_protein_g}g</span>
              <span className="text-slate-500 flex items-center gap-1"><Wheat size={12} className="text-amber-400" /> C: {plan.target_carbs_g}g</span>
              <span className="text-slate-500 flex items-center gap-1"><Droplets size={12} className="text-sky-400" /> G: {plan.target_fat_g}g</span>
            </div>
          </div>

          {/* Day selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {plan.days.map(d => {
              const totals = getDayTotals(d.day_number)
              const kcalPct = plan.target_kcal > 0 ? Math.round((totals.kcal / plan.target_kcal) * 100) : 0
              return (
                <button key={d.day_number} onClick={() => setActiveDay(d.day_number)}
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${activeDay === d.day_number ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-white'}`}>
                  <div className="font-semibold">Dia {d.day_number}</div>
                  {d.day_theme && <div className="text-xs opacity-70 truncate max-w-[100px]">{d.day_theme}</div>}
                  <div className={`text-xs mt-0.5 ${kcalPct >= 90 && kcalPct <= 110 ? 'text-emerald-400' : kcalPct > 110 ? 'text-rose-400' : 'text-amber-400'}`}>
                    {totals.kcal} kcal
                  </div>
                </button>
              )
            })}
          </div>

          {/* Day content */}
          {plan.days.filter(d => d.day_number === activeDay).map(day => {
            const totals = getDayTotals(day.day_number)
            return (
              <div key={day.day_number} className="space-y-4">
                {/* Day totals bar */}
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: 'Kcal', value: totals.kcal, target: plan.target_kcal, icon: Flame, color: 'text-orange-400' },
                    { label: 'Proteína', value: totals.protein, target: plan.target_protein_g, icon: Drumstick, color: 'text-rose-400', unit: 'g' },
                    { label: 'Carbs', value: totals.carbs, target: plan.target_carbs_g, icon: Wheat, color: 'text-amber-400', unit: 'g' },
                    { label: 'Gordura', value: totals.fat, target: plan.target_fat_g, icon: Droplets, color: 'text-sky-400', unit: 'g' },
                    { label: 'Fibra', value: totals.fiber, target: 25, icon: Droplets, color: 'text-emerald-400', unit: 'g' },
                  ].map(m => {
                    const pct = m.target ? Math.min(Math.round((m.value / m.target) * 100), 150) : 0
                    return (
                      <div key={m.label} className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
                        <div className="flex items-center gap-1 mb-1">
                          <m.icon size={12} className={m.color} />
                          <span className="text-xs text-slate-500">{m.label}</span>
                        </div>
                        <p className="text-sm font-bold text-white">{m.value}{m.unit || ''} <span className="text-xs text-slate-500 font-normal">/ {m.target}</span></p>
                        <div className="w-full bg-slate-700/50 rounded-full h-1.5 mt-1">
                          <div className={`h-full rounded-full transition-all ${pct >= 90 && pct <= 110 ? 'bg-emerald-500' : pct > 110 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Meals */}
                {day.meals.map((meal, mealIdx) => {
                  const mealMeta = MEAL_TYPES.find(t => t.value === meal.meal_type)
                  return (
                    <div key={mealIdx} className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <span>{mealMeta?.emoji || '🍽️'}</span>
                          {meal.meal_label || mealMeta?.label || meal.meal_type}
                          {(meal.time || mealMeta?.time) && (
                            <span className="text-xs font-normal text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded">
                              {meal.time || mealMeta?.time}
                            </span>
                          )}
                        </h4>
                        <span className="text-xs text-slate-500">
                          {Math.round(meal.items.reduce((s, i) => s + (i.calc_kcal || 0), 0))} kcal
                        </span>
                      </div>
                      <div className="divide-y divide-slate-700/20">
                        {meal.items.map((item, itemIdx) => {
                          const itemKey = `${day.day_number}-${meal.meal_type}-${itemIdx}`
                          const isEditing = editingItem === itemKey
                          return (
                            <div key={itemIdx} className="px-4 py-2.5 flex items-center gap-3 group hover:bg-slate-700/10 transition-colors">
                              <div className="flex-1 min-w-0">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="relative">
                                      <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                                      <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Buscar alimento TACO..."
                                        className="w-full bg-slate-700 border border-indigo-500/50 rounded-lg pl-8 pr-3 py-2 text-sm text-white" />
                                    </div>
                                    {searchResults.length > 0 && (
                                      <div className="bg-slate-700 rounded-lg border border-slate-600 max-h-48 overflow-y-auto">
                                        {searchResults.map(food => (
                                          <button key={food.id} onClick={() => replaceItem(day.day_number, meal.meal_type, itemIdx, food, food.serving_size_g || 100)}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-600 transition-colors border-b border-slate-600/30 last:border-0">
                                            <div className="text-sm text-white">{food.name}</div>
                                            <div className="text-xs text-slate-400">
                                              {food.energy_kcal}kcal · P:{food.protein_g}g · C:{food.carbs_g}g · G:{food.total_fat_g}g
                                              <span className="text-slate-500"> · {food.category} · {food.serving_label}</span>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    <button onClick={() => { setEditingItem(null); setSearchQuery(''); setSearchResults([]) }}
                                      className="text-xs text-slate-500 hover:text-white transition-colors">Cancelar</button>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm text-white truncate">{item.food_name}</p>
                                    <p className="text-xs text-slate-500">
                                      {item.quantity_g}g{item.serving_label ? ` (${item.serving_qty} ${item.serving_label})` : ''} · {Math.round(item.calc_kcal)} kcal · P:{Math.round(item.calc_protein_g)}g · C:{Math.round(item.calc_carbs_g)}g · G:{Math.round(item.calc_fat_g)}g
                                    </p>
                                    {item.preparation_notes && <p className="text-xs text-indigo-400/70 mt-0.5">{item.preparation_notes}</p>}
                                  </>
                                )}
                              </div>
                              {!isEditing && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditingItem(itemKey); setSearchQuery('') }} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-indigo-400" title="Trocar alimento">
                                    <Edit3 size={14} />
                                  </button>
                                  <button onClick={() => removeItem(day.day_number, meal.meal_type, itemIdx)} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-rose-400" title="Remover">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* TAB: Plans list */}
      {tab === 'plans' && (
        <div className="space-y-4">
          {loadingPlans ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16">
              <Utensils size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">Nenhum cardápio criado ainda.</p>
              <Button onClick={() => setTab('generate')} className="mt-4 bg-indigo-600 text-white"><Sparkles size={14} className="mr-2" />Gerar primeiro cardápio</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map(p => (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5 hover:border-slate-600/50 transition-colors cursor-pointer"
                  onClick={async () => {
                    // Load full plan
                    const res = await fetch(`/api/admin/meal-plans?id=${p.id}`)
                    const data = await res.json()
                    if (data.plan) {
                      const dayNums = [...new Set((data.items || []).map((i: any) => i.day_number))].sort()
                      const planDays: DayPlan[] = (dayNums as number[]).map(dn => {
                        const dayItems = data.items.filter((i: any) => i.day_number === dn)
                        const mealTypes = [...new Set(dayItems.map((i: any) => i.meal_type))]
                        return {
                          day_number: dn,
                          meals: mealTypes.map(mt => ({
                            meal_type: mt as string,
                            meal_label: dayItems.find((i: any) => i.meal_type === mt)?.meal_label || mt,
                            items: dayItems.filter((i: any) => i.meal_type === mt),
                          })),
                        }
                      })
                      setPlan({ ...data.plan, days: planDays })
                      setActiveDay(1)
                      setTab('generate')
                    }
                  }}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-semibold text-sm truncate">{p.title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {p.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{p.description || p.goal}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{p.duration_days}d</span>
                    <span>{p.target_kcal} kcal</span>
                    <span>P:{p.target_protein_g}g</span>
                    {p.is_ai_generated && <span className="text-indigo-400 flex items-center gap-1"><Sparkles size={10} />IA</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
