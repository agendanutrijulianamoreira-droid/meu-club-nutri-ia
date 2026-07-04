"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, Droplet, Plus, Loader2, Minus } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase-browser"
import { ProgressRing } from "@/components/patient/ProgressRing"
import { goalForWeight } from "@/lib/hydration"

const QUICK_AMOUNTS = [250, 500]

const TIPS = [
  "Evite beber água durante as refeições — prefira 30 min antes ou depois.",
  "Comece o dia com um copo de água em jejum.",
  "Leve uma garrafinha com você para lembrar de beber ao longo do dia.",
  "Sinais de sede já indicam desidratação leve — beba antes de sentir sede.",
]

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function HidratacaoPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [waterMl, setWaterMl] = useState(0)
  const [goalMl, setGoalMl] = useState(2000)
  const [customAmount, setCustomAmount] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const tip = TIPS[new Date().getDate() % TIPS.length]

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [{ data: profile }, { data: log }] = await Promise.all([
        supabase.from('profiles').select('current_weight').eq('user_id', user.id).single(),
        supabase.from('daily_logs').select('water_ml').eq('user_id', user.id).eq('log_date', todayStr()).single(),
      ])

      setGoalMl(goalForWeight(profile?.current_weight ?? null))
      setWaterMl(log?.water_ml ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  const addWater = useCallback(async (amountMl: number) => {
    if (amountMl <= 0) return
    setSaving(true)
    const newTotal = Math.max(0, waterMl + amountMl)
    setWaterMl(newTotal)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const hitGoal = newTotal >= goalMl
      await supabase.from('daily_logs').upsert({
        user_id: user.id,
        log_date: todayStr(),
        water_ml: newTotal,
        water_check: hitGoal,
      }, { onConflict: 'user_id,log_date' })

      if (hitGoal && waterMl < goalMl) showToast('Meta de hidratação batida! 💧')
    } finally {
      setSaving(false)
    }
  }, [waterMl, goalMl])

  const pct = goalMl > 0 ? Math.min((waterMl / goalMl) * 100, 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-sky-400" size={28} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-10">
      <div className="sticky top-0 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 z-10">
        <div className="max-w-md mx-auto px-4 pt-4 pb-3 flex items-center gap-3">
          <Link href="/patient/home" className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white">Hidratação</h1>
            <p className="text-[11px] text-slate-500">Hidrate-se, viva melhor 💧</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="max-w-md mx-auto px-4 mt-3">
            <div className="px-4 py-3 rounded-2xl text-sm font-medium border bg-sky-500/10 border-sky-500/25 text-sky-400">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-5">
        {/* Anel principal */}
        <div className="flex flex-col items-center py-4">
          <ProgressRing value={waterMl} max={goalMl} size={180} strokeWidth={14} color="#38bdf8">
            <Droplet size={28} className="text-sky-400 mb-1" />
            <span className="text-white text-3xl font-black leading-none">{(waterMl / 1000).toFixed(1)}L</span>
            <span className="text-slate-500 text-xs mt-1">Meta: {(goalMl / 1000).toFixed(1)}L</span>
          </ProgressRing>
        </div>

        {/* Barra + % */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300 font-bold">{waterMl}ml / {goalMl}ml</span>
            <span className="text-sky-400 text-sm font-black">{Math.round(pct)}%</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full bg-sky-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
          </div>
        </div>

        {/* Quick add */}
        <div className="grid grid-cols-3 gap-2">
          {QUICK_AMOUNTS.map(amount => (
            <button
              key={amount}
              onClick={() => addWater(amount)}
              disabled={saving}
              className="flex flex-col items-center gap-1.5 py-4 bg-white/5 border border-white/10 hover:border-sky-500/30 rounded-2xl transition-all disabled:opacity-50"
            >
              <Droplet size={18} className="text-sky-400" />
              <span className="text-white text-sm font-bold">{amount}ml</span>
            </button>
          ))}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-2xl px-2">
            <input
              type="number"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              placeholder="ml"
              className="w-full bg-transparent text-white text-sm text-center placeholder-slate-600 outline-none"
            />
            <button
              onClick={() => { const v = parseInt(customAmount) || 0; if (v > 0) { addWater(v); setCustomAmount('') } }}
              disabled={saving || !customAmount}
              className="p-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl transition-all shrink-0"
            >
              <Plus size={14} className="text-white" />
            </button>
          </div>
        </div>

        {waterMl > 0 && (
          <button
            onClick={() => addWater(-Math.min(250, waterMl))}
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-slate-500 hover:text-white text-xs transition-colors disabled:opacity-50"
          >
            <Minus size={12} /> Desfazer último registro
          </button>
        )}

        {/* Dica */}
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl px-4 py-3">
          <p className="text-sky-400/90 text-xs">{tip}</p>
        </div>
      </div>
    </div>
  )
}
