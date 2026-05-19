"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Flame, Drumstick, Wheat, Droplets, RefreshCw } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface MealItem {
  food: string
  quantity_g?: number
  quantity_label?: string
}

interface Substitution {
  ingredient: string
  option_1: string
  option_2?: string
}

interface PremiumMeal {
  name: string
  kcal?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  items?: MealItem[]
  substitutions?: Substitution[]
}

interface PremiumDay {
  day: number
  total_kcal?: number
  total_protein_g?: number
  total_carbs_g?: number
  total_fat_g?: number
  meals: PremiumMeal[]
}

interface PremiumPlan {
  title: string
  total_kcal_day?: number
  days: PremiumDay[]
}

export function MealPlanPremium({ plan, currentDay = 1 }: { plan: PremiumPlan; currentDay?: number }) {
  const [activeDay, setActiveDay] = useState(currentDay)
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null)
  const [showSubs, setShowSubs] = useState<number | null>(null)

  const day = plan.days.find(d => d.day === activeDay) ?? plan.days[0]

  return (
    <div className="space-y-4">
      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {plan.days.map(d => (
          <button key={d.day} onClick={() => setActiveDay(d.day)}
            className={`shrink-0 w-10 h-10 rounded-2xl text-sm font-bold transition-all ${activeDay === d.day ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
            {d.day}
          </button>
        ))}
      </div>

      {/* Daily macros summary */}
      {day && (day.total_kcal || day.total_protein_g) && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'kcal', value: day.total_kcal, icon: Flame, color: 'text-orange-400' },
            { label: 'prot', value: day.total_protein_g ? `${day.total_protein_g}g` : null, icon: Drumstick, color: 'text-rose-400' },
            { label: 'carb', value: day.total_carbs_g ? `${day.total_carbs_g}g` : null, icon: Wheat, color: 'text-amber-400' },
            { label: 'gord', value: day.total_fat_g ? `${day.total_fat_g}g` : null, icon: Droplets, color: 'text-blue-400' },
          ].map(m => m.value ? (
            <div key={m.label} className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center">
              <m.icon className={`w-3.5 h-3.5 ${m.color} mx-auto mb-1`} />
              <p className="text-white text-xs font-bold">{m.value}</p>
              <p className="text-slate-600 text-[9px] uppercase">{m.label}</p>
            </div>
          ) : null)}
        </div>
      )}

      {/* Meals */}
      <AnimatePresence mode="wait">
        <motion.div key={activeDay} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-2">
          {day?.meals.map((meal, idx) => (
            <div key={idx} className="bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden">
              <button onClick={() => setExpandedMeal(expandedMeal === idx ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <p className="text-white text-sm font-medium">{meal.name}</p>
                  {meal.kcal && <span className="text-orange-400 text-xs font-bold">{meal.kcal} kcal</span>}
                </div>
                <div className="flex items-center gap-2">
                  {meal.protein_g && <span className="text-slate-500 text-xs">{meal.protein_g}g prot</span>}
                  {expandedMeal === idx ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </button>

              <AnimatePresence>
                {expandedMeal === idx && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden border-t border-white/5">
                    <div className="px-4 py-3 space-y-3">
                      {/* Macro chips */}
                      {(meal.protein_g || meal.carbs_g || meal.fat_g) && (
                        <div className="flex gap-2 flex-wrap">
                          {meal.protein_g && <span className="text-[10px] px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">{meal.protein_g}g prot</span>}
                          {meal.carbs_g && <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">{meal.carbs_g}g carb</span>}
                          {meal.fat_g && <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">{meal.fat_g}g gord</span>}
                        </div>
                      )}

                      {/* Ingredients */}
                      {meal.items && meal.items.length > 0 && (
                        <div className="space-y-1.5">
                          {meal.items.map((item, iIdx) => (
                            <div key={iIdx} className="flex items-center justify-between">
                              <span className="text-slate-300 text-sm">{item.food}</span>
                              <span className="text-slate-500 text-xs">{item.quantity_label ?? (item.quantity_g ? `${item.quantity_g}g` : '')}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Substitutions */}
                      {meal.substitutions && meal.substitutions.length > 0 && (
                        <div>
                          <button onClick={() => setShowSubs(showSubs === idx ? null : idx)}
                            className="flex items-center gap-1.5 text-indigo-400 text-xs font-medium">
                            <RefreshCw className="w-3 h-3" />
                            {showSubs === idx ? 'Ocultar substituições' : 'Ver substituições'}
                          </button>
                          <AnimatePresence>
                            {showSubs === idx && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="mt-2 space-y-1.5">
                                {meal.substitutions.map((sub, sIdx) => (
                                  <div key={sIdx} className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl px-3 py-2">
                                    <p className="text-slate-400 text-xs mb-1">Em vez de <span className="text-white font-medium">{sub.ingredient}</span>:</p>
                                    <p className="text-indigo-300 text-xs">→ {sub.option_1}</p>
                                    {sub.option_2 && <p className="text-indigo-300 text-xs">→ {sub.option_2}</p>}
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
