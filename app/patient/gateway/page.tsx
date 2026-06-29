"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"
import {
  Calendar, Zap, Dna, Package, ExternalLink, ArrowRight,
  ChevronRight, Star, Lock, Sparkles, TrendingUp, Crown,
  Video, HeartPulse, Loader2, CheckCircle2
} from "lucide-react"

interface GatewayProduct {
  id: string
  name: string
  description?: string
  short_pitch?: string
  product_type: 'consultation' | 'program_90d' | 'genetic_test' | 'custom'
  price_label?: string
  cta_text: string
  external_url?: string
  badge_text?: string
  trigger_type: string
  is_active: boolean
}

interface Professional {
  id: string
  name: string
  photo_url: string
  profession: string
  specialty: string
  is_virtual: boolean
  price_display: string
  rating: number
  is_featured: boolean
}

interface Profile {
  name: string
  current_plan: string
  current_streak: number
  total_xp: number
  current_level: number
}

const TYPE_META = {
  consultation: {
    label: 'Consulta Individual',
    icon: Calendar,
    gradient: 'from-indigo-600 to-indigo-400',
    glow: 'bg-indigo-600/20',
    badge: 'bg-indigo-500/15 border-indigo-500/25 text-indigo-400',
  },
  program_90d: {
    label: 'Método 90 Dias',
    icon: Zap,
    gradient: 'from-amber-500 to-orange-400',
    glow: 'bg-amber-500/20',
    badge: 'bg-amber-500/15 border-amber-500/25 text-amber-400',
  },
  genetic_test: {
    label: 'Teste Genético',
    icon: Dna,
    gradient: 'from-emerald-600 to-teal-400',
    glow: 'bg-emerald-600/20',
    badge: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
  },
  custom: {
    label: 'Oferta Especial',
    icon: Package,
    gradient: 'from-slate-600 to-slate-400',
    glow: 'bg-white/5',
    badge: 'bg-white/10 border-white/15 text-slate-400',
  },
} as const

const PLAN_LABELS: Record<string, { label: string; color: string; icon: typeof Star }> = {
  community: { label: 'Clube', color: 'text-slate-400', icon: Star },
  tech_diet: { label: 'Modo Paciente', color: 'text-indigo-400', icon: Zap },
  vip: { label: 'Modo Paciente', color: 'text-amber-400', icon: Crown },
}

export default function PatientGatewayPage() {
  const [products, setProducts] = useState<GatewayProduct[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [interacted, setInteracted] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([loadProfile(), loadProducts(), loadProfessionals()])
      .finally(() => setLoading(false))
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('name, current_plan, current_streak, total_xp, current_level')
      .eq('user_id', user.id)
      .single()
    if (data) setProfile(data as Profile)
  }

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/patient/gateway-products')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch {
      setProducts([])
    }
  }

  const loadProfessionals = async () => {
    try {
      const res = await fetch('/api/patient/professionals')
      const data = await res.json()
      setProfessionals((data.professionals || []).slice(0, 3))
    } catch {
      setProfessionals([])
    }
  }

  const handleProductClick = async (product: GatewayProduct) => {
    // Register interaction
    try {
      await fetch('/api/patient/gateway-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, interaction_type: 'click' }),
      })
    } catch { /* fail silently */ }

    setInteracted(prev => new Set([...prev, product.id]))

    if (product.external_url) {
      window.open(product.external_url, '_blank', 'noopener,noreferrer')
    }
  }

  const planMeta = PLAN_LABELS[profile?.current_plan ?? 'community']
  const PlanIcon = planMeta?.icon ?? Star

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 pt-6 pb-6 max-w-md mx-auto">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={16} className="text-indigo-400" />
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sua Jornada</p>
        </div>
        <h1 className="text-3xl font-light text-white">
          Próximo <span className="font-bold text-indigo-400">Passo</span>
        </h1>
        {profile && (
          <div className="flex items-center gap-3 mt-3">
            <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${profile.current_plan === 'vip' ? 'bg-amber-500/15 border-amber-500/25 text-amber-400' : 'bg-indigo-500/15 border-indigo-500/25 text-indigo-400'}`}>
              <PlanIcon size={11} />
              {planMeta?.label}
            </span>
            <span className="text-xs text-slate-500">
              Nível {profile.current_level} · {profile.total_xp} XP
            </span>
          </div>
        )}
      </motion.div>

      {/* Progress Banner */}
      {profile && profile.current_streak > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6 bg-gradient-to-r from-indigo-600/20 to-indigo-600/5 border border-indigo-500/20 rounded-3xl p-4 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 flex items-center justify-center shrink-0">
            <Sparkles size={22} className="text-indigo-300" />
          </div>
          <div>
            <p className="text-white text-sm font-bold">
              {profile.current_streak} dias seguidos! 🔥
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              Você está no ritmo certo. Veja as ofertas exclusivas para você.
            </p>
          </div>
        </motion.div>
      )}

      {/* Gateway Products */}
      <AnimatePresence>
        {products.length > 0 ? (
          <div className="space-y-4 mb-8">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Ofertas para você
            </p>
            {products.map((product, i) => {
              const meta = TYPE_META[product.product_type] ?? TYPE_META.custom
              const Icon = meta.icon
              const clicked = interacted.has(product.id)

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:border-indigo-500/30 transition-all"
                >
                  {/* Top accent gradient */}
                  <div className={`h-1 w-full bg-gradient-to-r ${meta.gradient}`} />

                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-11 h-11 rounded-2xl ${meta.glow} flex items-center justify-center shrink-0`}>
                        <Icon size={20} className={`bg-gradient-to-br ${meta.gradient} bg-clip-text`} style={{ color: 'transparent', WebkitBackgroundClip: 'text' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${meta.badge}`}>
                            {meta.label}
                          </span>
                          {product.badge_text && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-rose-500/15 border-rose-500/25 text-rose-400">
                              {product.badge_text}
                            </span>
                          )}
                        </div>
                        <h3 className="text-white font-bold text-sm leading-tight">{product.name}</h3>
                      </div>
                      {product.price_label && (
                        <span className="text-white font-black text-sm shrink-0">{product.price_label}</span>
                      )}
                    </div>

                    {product.short_pitch && (
                      <p className="text-slate-400 text-xs leading-relaxed mb-4">
                        {product.short_pitch}
                      </p>
                    )}

                    <button
                      onClick={() => handleProductClick(product)}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${clicked
                        ? 'bg-emerald-600/20 border border-emerald-500/25 text-emerald-400'
                        : `bg-gradient-to-r ${meta.gradient} text-white hover:opacity-90 active:scale-95`
                        }`}
                    >
                      {clicked ? (
                        <>
                          <CheckCircle2 size={15} />
                          Enviado!
                        </>
                      ) : (
                        <>
                          {product.cta_text}
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 bg-white/[0.03] border border-white/5 rounded-3xl p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={24} className="text-indigo-400" />
            </div>
            <p className="text-white font-bold mb-1">Nenhuma oferta no momento</p>
            <p className="text-slate-500 text-sm">Continue sua jornada — ofertas exclusivas aparecem conforme você avança.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Specialists Section */}
      {professionals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Especialistas disponíveis
            </p>
            <a href="/patient/professionals" className="text-xs text-indigo-400 font-bold flex items-center gap-1">
              Ver todos <ChevronRight size={12} />
            </a>
          </div>

          {professionals.map((prof, i) => (
            <motion.a
              key={prof.id}
              href="/patient/professionals"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 hover:border-indigo-500/30 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                {prof.photo_url ? (
                  <img src={prof.photo_url} alt={prof.name} className="w-full h-full object-cover" />
                ) : (
                  <HeartPulse size={18} className="text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{prof.name}</p>
                <p className="text-slate-500 text-xs truncate">{prof.specialty || prof.profession}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {prof.is_virtual && (
                  <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                    <Video size={10} /> Online
                  </span>
                )}
                <span className="text-slate-400 text-xs font-bold">{prof.price_display}</span>
              </div>
            </motion.a>
          ))}
        </div>
      )}

      {/* Upgrade nudge if on free plan */}
      {profile?.current_plan === 'community' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 bg-gradient-to-br from-indigo-600/15 to-indigo-600/5 border border-indigo-500/25 rounded-3xl p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Crown size={16} className="text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Modo Paciente</span>
          </div>
          <p className="text-white text-sm font-bold mb-1">Dieta personalizada + IA + receitas</p>
          <p className="text-slate-400 text-xs mb-4">
            Desbloqueie cardápio com macros, receitas vinculadas ao seu protocolo, lista de compras calculada e muito mais.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="/patient/upgrade"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl transition-all"
            >
              <Sparkles size={13} />
              Ver planos
            </a>
            <span className="text-slate-500 text-xs">A partir de R$47/ano</span>
          </div>
        </motion.div>
      )}

    </div>
  )
}
