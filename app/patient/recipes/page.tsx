"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChefHat, Clock, Users, Lock, Loader2, Search,
  ChevronLeft, ChevronDown, ChevronUp, Star, Leaf
} from "lucide-react"
import Link from "next/link"

interface RecipeComponent { label: string; quantity: number | null; unit: string | null }
interface Substitution { ingredient: string; substitute: string; reason: string }

interface Recipe {
  id: string
  title: string
  description: string | null
  emoji: string
  category: string | null
  dietary_tags: string[]
  prep_time_min: number | null
  servings: number
  components: RecipeComponent[]
  instructions: string
  substitutions: Substitution[]
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  access_tier: 'basic' | 'premium'
}

const CATEGORIES = ['todos', 'café da manhã', 'lanche', 'almoço', 'jantar', 'sobremesa', 'shot', 'bebida']
const CAT_EMOJI: Record<string, string> = {
  'todos': '🍽️', 'café da manhã': '🌅', 'lanche': '🍎', 'almoço': '☀️',
  'jantar': '🌙', 'sobremesa': '🍮', 'shot': '⚡', 'bebida': '🥤',
}

const RESTRICTION_LABELS: Record<string, string> = {
  lactose: 'Sem lactose', gluten: 'Sem glúten', vegana: 'Vegana',
  vegetariana: 'Vegetariana', low_carb: 'Low Carb', sem_acucar: 'Sem açúcar',
}

function MacroBadge({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="text-center bg-white/5 rounded-xl px-3 py-2">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-white">{Math.round(value)}<span className="text-[10px] text-slate-500 font-normal">{unit}</span></p>
    </div>
  )
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden">
      {/* Header */}
      <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setOpen(!open)}>
        <span className="text-2xl shrink-0">{recipe.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {recipe.access_tier === 'premium' && (
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center gap-0.5">
                <Lock size={8}/> Premium
              </span>
            )}
            {recipe.dietary_tags?.map(t => (
              <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                {RESTRICTION_LABELS[t] || t}
              </span>
            ))}
          </div>
          <p className="text-sm font-bold text-white leading-tight">{recipe.title}</p>
          {recipe.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{recipe.description}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-600">
            {recipe.prep_time_min && <span className="flex items-center gap-0.5"><Clock size={9}/> {recipe.prep_time_min}min</span>}
            <span className="flex items-center gap-0.5"><Users size={9}/> {recipe.servings} porção{recipe.servings !== 1 ? 'ões' : ''}</span>
            {recipe.calories && <span>🔥 {recipe.calories} kcal</span>}
          </div>
        </div>
        <div className="text-slate-600 shrink-0 mt-1">
          {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </div>
      </button>

      {/* Conteúdo expandido */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-5 space-y-4 border-t border-white/5 pt-4">
              {/* Macros (premium) */}
              {recipe.calories && (
                <div className="grid grid-cols-4 gap-2">
                  <MacroBadge label="Kcal" value={recipe.calories} unit=""/>
                  {recipe.protein_g && <MacroBadge label="Prot" value={recipe.protein_g} unit="g"/>}
                  {recipe.carbs_g && <MacroBadge label="Carb" value={recipe.carbs_g} unit="g"/>}
                  {recipe.fat_g && <MacroBadge label="Gorд" value={recipe.fat_g} unit="g"/>}
                </div>
              )}

              {/* Ingredientes */}
              {recipe.components?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Ingredientes</p>
                  <ul className="space-y-1.5">
                    {recipe.components.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-indigo-500 shrink-0 font-bold mt-0.5">·</span>
                        <span className="text-slate-300">
                          {c.quantity && <span className="font-semibold text-white">{c.quantity}{c.unit ? ` ${c.unit}` : ''} </span>}
                          {c.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preparo */}
              {recipe.instructions && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Modo de Preparo</p>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{recipe.instructions}</p>
                </div>
              )}

              {/* Substituições */}
              {recipe.substitutions?.length > 0 && (
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-3 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Substituições sugeridas</p>
                  {recipe.substitutions.map((s, i) => (
                    <p key={i} className="text-xs text-slate-400">
                      <span className="font-semibold text-white">{s.ingredient}</span>
                      <span className="text-slate-600"> → </span>
                      {s.substitute}
                      {s.reason && <span className="text-slate-600 italic"> ({s.reason})</span>}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function PatientRecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [activeCategory, setActiveCategory] = useState('todos')
  const [search, setSearch] = useState('')

  const load = useCallback(async (category?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category && category !== 'todos') params.set('category', category)
      const res = await fetch(`/api/patient/recipes?${params}`)
      const data = await res.json()
      setRecipes(data.recipes || [])
      setIsPremium(data.is_premium || false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(activeCategory) }, [activeCategory])

  const filtered = recipes.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0f172a] to-[#1e1b4b]">
      {/* Header */}
      <div className="sticky top-0 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 z-10">
        <div className="max-w-md mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/patient/home"
              className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all">
              <ChevronLeft size={20}/>
            </Link>
            <div className="flex-1">
              <h1 className="text-base font-bold text-white">Receitas do Clube</h1>
              <p className="text-[11px] text-slate-500">{filtered.length} receitas disponíveis</p>
            </div>
            {isPremium && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center gap-1">
                <Star size={9}/> Premium
              </span>
            )}
          </div>

          {/* Busca */}
          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar receita..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/40"/>
          </div>

          {/* Categorias scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                  activeCategory === cat ? 'bg-indigo-600 text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:border-white/20'
                }`}>
                {CAT_EMOJI[cat]} {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="max-w-md mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-slate-600"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🍽️</div>
            <p className="text-slate-400 font-medium mb-1">Nenhuma receita ainda</p>
            <p className="text-slate-600 text-sm">
              {search ? 'Tente outro termo de busca' : 'Sua nutricionista está preparando receitas especiais para você'}
            </p>
          </div>
        ) : (
          <>
            {!isPremium && recipes.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-500/8 border border-amber-500/15 rounded-2xl mb-2">
                <Lock size={13} className="text-amber-400 shrink-0"/>
                <p className="text-xs text-slate-400">
                  Faça upgrade para <span className="text-amber-400 font-semibold">Premium</span> e acesse receitas com cálculo nutricional e substituições detalhadas.
                </p>
              </div>
            )}
            <AnimatePresence>
              {filtered.map(r => <RecipeCard key={r.id} recipe={r}/>)}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}
