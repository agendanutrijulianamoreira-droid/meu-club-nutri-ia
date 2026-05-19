"use client"

import { useState } from "react"
import { Coffee, Sun, Moon, Apple, Leaf, Sunset } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface BasicMeal {
  name: string
  description: string
  tip?: string
}

interface BasicDay {
  day: number
  meals: BasicMeal[]
}

interface BasicPlan {
  title: string
  days: BasicDay[]
}

const MEAL_ICONS: Record<string, any> = {
  'café': Coffee,
  'almoço': Sun,
  'jantar': Moon,
  'lanche': Apple,
  'shot': Leaf,
  'ceia': Sunset,
}

const getMealIcon = (name: string) => {
  const lower = name.toLowerCase()
  for (const [key, Icon] of Object.entries(MEAL_ICONS)) {
    if (lower.includes(key)) return Icon
  }
  return Sun
}

export function MealPlanBasic({ plan, currentDay = 1 }: { plan: BasicPlan; currentDay?: number }) {
  const [activeDay, setActiveDay] = useState(currentDay)

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

      {/* Meals */}
      <AnimatePresence mode="wait">
        <motion.div key={activeDay} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="space-y-3">
          {day?.meals.map((meal, idx) => {
            const Icon = getMealIcon(meal.name)
            return (
              <div key={idx} className="bg-slate-900/80 border border-white/10 rounded-3xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-white text-sm font-semibold">{meal.name}</p>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed pl-11">{meal.description}</p>
                {meal.tip && (
                  <p className="text-indigo-400 text-xs mt-2 pl-11 italic">💡 {meal.tip}</p>
                )}
              </div>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
