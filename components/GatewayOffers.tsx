"use client"

import { useState, useEffect } from "react"
import { ArrowUpRight, X, Zap, Calendar, Dna, Package } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface GatewayProduct {
  id: string
  name: string
  short_pitch?: string
  product_type: string
  price_label?: string
  cta_text: string
  external_url?: string
  badge_text?: string
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  consultation: Calendar,
  program_90d: Zap,
  genetic_test: Dna,
  custom: Package,
}

const TYPE_COLORS: Record<string, string> = {
  consultation: 'from-indigo-600/20 to-indigo-600/5 border-indigo-500/30',
  program_90d: 'from-amber-600/20 to-amber-600/5 border-amber-500/30',
  genetic_test: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/30',
  custom: 'from-slate-600/20 to-slate-600/5 border-slate-500/30',
}

export function GatewayOffers() {
  const [offers, setOffers] = useState<GatewayProduct[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/patient/gateway-products')
      .then(r => r.json())
      .then(d => setOffers(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const handleDismiss = async (id: string) => {
    setDismissed(prev => new Set([...prev, id]))
    await fetch('/api/patient/gateway-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: id, interaction_type: 'dismissed' })
    }).catch(() => {})
  }

  const handleClick = async (product: GatewayProduct) => {
    await fetch('/api/patient/gateway-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: product.id, interaction_type: 'click' })
    }).catch(() => {})
    if (product.external_url) window.open(product.external_url, '_blank', 'noopener,noreferrer')
  }

  const visible = offers.filter(o => !dismissed.has(o.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Próximos passos</p>
      <AnimatePresence>
        {visible.map(offer => {
          const Icon = TYPE_ICONS[offer.product_type] ?? Package
          const gradient = TYPE_COLORS[offer.product_type] ?? TYPE_COLORS.custom
          return (
            <motion.div key={offer.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className={`relative bg-gradient-to-br ${gradient} border rounded-3xl p-4`}>
              <button onClick={() => handleDismiss(offer.id)}
                className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white rounded-full hover:bg-white/10">
                <X className="w-3 h-3" />
              </button>
              <div className="flex items-start gap-3 pr-6">
                <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-semibold">{offer.name}</span>
                    {offer.badge_text && (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {offer.badge_text}
                      </span>
                    )}
                  </div>
                  {offer.short_pitch && <p className="text-slate-300 text-xs mt-0.5">{offer.short_pitch}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {offer.price_label && <span className="text-emerald-400 text-sm font-bold">{offer.price_label}</span>}
                    <button onClick={() => handleClick(offer)}
                      className="flex items-center gap-1 text-white text-xs font-bold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl transition-all">
                      {offer.cta_text} <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
