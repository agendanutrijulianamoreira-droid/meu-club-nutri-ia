"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChefHat, Clock, Users, Lock, Loader2, Search,
  ChevronLeft, ChevronDown, ChevronUp, Star, Leaf
} from "lucide-react"
import Link from "next/link"

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
    <div className="text-center bg-sand-50 rounded-xl px-3 py-2">
      <p className="text-[10px] text-stone-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-stone-800">{Math.round(value)}<span className="text-[10px] text-stone-400 font-normal">{unit}</span></p>
    </div>
  )
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-[1.75rem] overflow-hidden">
      {/* "Capa" da receita — placeholder ilustrado até termos fotos reais no catálogo */}
      <button className="w-full text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-center h-28 bg-gradient-to-br from-sage-50 to-sand-100">
          <span className="text-5xl">{recipe.emoji}</span>
        </div>
        <div className="p-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {recipe.access_tier === 'premium' && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-clay-50 border border-clay-200/70 text-clay-600 flex items-center gap-0.5">
                  <Lock size={8}/> Premium
                </span>
              )}
              {recipe.dietary_tags?.map(t => (
                <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-sage-50 border border-sage-200/60 text-sage-700">
                  {RESTRICTION_LABELS[t] || t}
                </span>
              ))}
            </div>
            <p className="font-display text-base font-medium text-stone-800 leading-tight">{recipe.title}</p>
            {recipe.description && <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{recipe.description}</p>}
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-stone-400">
              {recipe.prep_time_min && <span className="flex items-center gap-0.5"><Clock size={9}/> {recipe.prep_time_min}min</span>}
              <span className="flex items-center gap-0.5"><Users size={9}/> {recipe.servings} porção{recipe.servings !== 1 ? 'ões' : ''}</span>
              {recipe.calories && <span>{recipe.calories} kcal</span>}
            </div>
          </div>
          <div className="text-stone-300 shrink-0 mt-1">
            {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </div>
        </div>
      </button>

      {/* Conteúdo expandido */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-5 space-y-4 border-t border-sage-900/[0.05] pt-4">
              {/* Macros (premium) */}
              {recipe.calories && (
                <div className="grid grid-cols-4 gap-2">
                  <MacroBadge label="Kcal" value={recipe.calories} unit=""/>
                  {recipe.protein_g && <MacroBadge label="Prot" value={recipe.protein_g} unit="g"/>}
                  {recipe.carbs_g && <MacroBadge label="Carb" value={recipe.carbs_g} unit="g"/>}
                  {recipe.fat_g && <MacroBadge label="Gord" value={recipe.fat_g} unit="g"/>}
                </div>
              )}

              {/* Ingredientes */}
              {recipe.ingredients?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Ingredientes</p>
                  <ul className="space-y-1.5">
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-sage-500 shrink-0 font-bold mt-0.5">·</span>
                        <span className="text-stone-600">
                          <span className="font-semibold text-stone-800">{ing.quantity}</span> {ing.item}
                          {ing.note && <span className="text-stone-400"> — {ing.note}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preparo */}
              {recipe.instructions && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Modo de Preparo</p>
                  <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">{recipe.instructions}</p>
                </div>
              )}

              {/* Substituições */}
              {recipe.substitutions?.length > 0 && (
                <div className="bg-sand-50 border border-sage-900/[0.05] rounded-2xl p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Substituições sugeridas</p>
                  {recipe.substitutions.map((s, i) => (
                    <p key={i} className="text-xs text-stone-500">
                      <span className="font-semibold text-stone-800">{s.ingredient}</span>
                      <span className="text-stone-400"> → </span>
                      {s.substitute}
                      {s.reason && <span className="text-stone-400 italic"> ({s.reason})</span>}
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
    <div className="min-h-screen bg-sand-50">
      {/* Header */}
      <div className="sticky top-0 bg-sand-50/90 backdrop-blur-xl border-b border-sage-900/[0.05] z-10">
        <div className="max-w-md mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/patient/home"
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-white transition-all">
              <ChevronLeft size={20}/>
            </Link>
            <div className="flex-1">
              <h1 className="font-display text-base font-medium text-stone-800">Receitas do Clube</h1>
              <p className="text-[11px] text-stone-500">{filtered.length} receitas disponíveis</p>
            </div>
            {isPremium && (
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-clay-50 border border-clay-200/70 text-clay-600 flex items-center gap-1">
                <Star size={9}/> Premium
              </span>
            )}
          </div>

          {/* Busca */}
          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar receita..."
              className="w-full bg-white border border-sage-900/[0.08] rounded-xl pl-8 pr-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-sage-400/60"/>
          </div>

          {/* Categorias scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  activeCategory === cat ? 'bg-sage-600 text-white' : 'bg-white border border-sage-900/[0.08] text-stone-500 hover:border-sage-300/60'
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
            <Loader2 size={22} className="animate-spin text-stone-300"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🍽️</div>
            <p className="text-stone-600 font-medium mb-1">Nenhuma receita ainda</p>
            <p className="text-stone-400 text-sm">
              {search ? 'Tente outro termo de busca' : 'Sua nutricionista está preparando receitas especiais para você'}
            </p>
          </div>
        ) : (
          <>
            {!isPremium && recipes.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-clay-50 border border-clay-200/60 rounded-2xl mb-2">
                <Lock size={13} className="text-clay-500 shrink-0"/>
                <p className="text-xs text-stone-600">
                  Faça upgrade para <span className="text-clay-600 font-semibold">Premium</span> e acesse receitas com cálculo nutricional e substituições detalhadas.
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
