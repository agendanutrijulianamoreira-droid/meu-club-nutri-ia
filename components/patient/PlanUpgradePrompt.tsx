"use client"

import { ArrowUpRight, Crown, Lock, Zap } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

interface PlanUpgradePromptProps {
  feature: string
  benefit: string
  onCtaClick?: () => void
  badgeLabel?: string
}

export function PlanUpgradePrompt({ feature, benefit, onCtaClick, badgeLabel = "Disponível no Modo Paciente" }: PlanUpgradePromptProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-indigo-500/10 border border-indigo-500/30 rounded-3xl p-5 text-center">
      <div className="w-10 h-10 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
        <Lock className="w-5 h-5 text-indigo-400" />
      </div>
      <p className="text-white font-semibold mb-1">{feature}</p>
      <p className="text-slate-400 text-sm mb-4">{benefit}</p>
      <div className="bg-indigo-600/20 border border-indigo-500/30 rounded-2xl px-4 py-2 inline-flex items-center gap-1.5 mb-3">
        <Crown className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-indigo-300 text-sm font-medium">{badgeLabel}</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        {onCtaClick ? (
          <button onClick={onCtaClick}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
            Ver planos <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Link href="/patient/upgrade"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
            Ver planos <Zap className="w-3.5 h-3.5" />
          </Link>
        )}
        <span className="text-slate-600 text-xs">a partir de R$47/ano</span>
      </div>
    </motion.div>
  )
}
