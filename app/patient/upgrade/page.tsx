"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"
import {
  Check, Lock, Zap, Crown, Calendar, ArrowLeft, Sparkles,
  Dna, ShoppingCart, Brain, Heart, Trophy, Users, Flame,
  ChevronRight, Star
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface TenantInfo {
  name: string
  brand_color: string
  logo_url: string
}

const CLUBE_FEATURES = [
  { icon: Flame, text: "Desafios e missões gamificados" },
  { icon: Users, text: "Comunidade e Tribo" },
  { icon: Trophy, text: "Ranking de XP" },
  { icon: Heart, text: "Plano alimentar genérico" },
  { icon: Calendar, text: "Protocolos sazonais" },
  { icon: Star, text: "Depoimentos de pacientes" },
]

const PACIENTE_FEATURES = [
  { icon: Zap, text: "Dieta personalizada com macros" },
  { icon: Crown, text: "Receitas vinculadas ao protocolo" },
  { icon: ShoppingCart, text: "Lista de compras calculada" },
  { icon: Brain, text: "IA assistente personalizada" },
  { icon: Dna, text: "Benefício no teste genético e microbiota" },
  { icon: Heart, text: "Protocolo de suplementação" },
  { icon: Trophy, text: "Programa de indicação com bônus" },
  { icon: Users, text: "Suporte próximo da nutricionista" },
]

export default function UpgradePage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<"annual" | "monthly">("annual")
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string>("community")

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('current_plan, plan_started_at, plan_expires_at, tenant_id')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        setCurrentPlan(profile.current_plan || 'community')
        if (profile.plan_expires_at) {
          const expires = new Date(profile.plan_expires_at)
          const now = new Date()
          const diff = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          setTrialDaysLeft(diff > 0 ? diff : 0)
        } else if (profile.plan_started_at) {
          // Calculate trial from started_at (15-day trial)
          const started = new Date(profile.plan_started_at)
          const expires = new Date(started.getTime() + 15 * 24 * 60 * 60 * 1000)
          const now = new Date()
          const diff = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          setTrialDaysLeft(diff > 0 ? diff : 0)
        }

        if (profile.tenant_id) {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('name, brand_color, logo_url')
            .eq('id', profile.tenant_id)
            .single()
          if (tenantData) setTenant(tenantData as TenantInfo)
        }
      }
    }
    load()
  }, [])

  const isAlreadyPaciente = currentPlan === 'vip' || currentPlan === 'tech_diet'

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="max-w-[430px] mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft size={16} className="text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-sm">Modo Paciente</h1>
            <p className="text-slate-500 text-xs">Desbloqueie tudo</p>
          </div>
          {tenant?.logo_url && (
            <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-8 rounded-xl object-cover" />
          )}
        </div>
      </div>

      <div className="max-w-[430px] mx-auto px-4 pt-6 space-y-6">

        {/* Trial warning */}
        <AnimatePresence>
          {trialDaysLeft !== null && trialDaysLeft <= 5 && !isAlreadyPaciente && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 border flex items-center gap-3 ${
                trialDaysLeft === 0
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <Flame size={18} className={trialDaysLeft === 0 ? 'text-rose-400' : 'text-amber-400'} />
              <div>
                <p className={`text-sm font-bold ${trialDaysLeft === 0 ? 'text-rose-300' : 'text-amber-300'}`}>
                  {trialDaysLeft === 0 ? 'Seu teste gratuito acabou' : `${trialDaysLeft} dia${trialDaysLeft > 1 ? 's' : ''} restante${trialDaysLeft > 1 ? 's' : ''} no teste`}
                </p>
                <p className="text-slate-400 text-xs">Continue com o Clube por R$47/ano</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Already paciente */}
        {isAlreadyPaciente ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-emerald-600/10 border border-emerald-500/30 rounded-3xl p-6 text-center"
          >
            <div className="w-14 h-14 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={26} className="text-emerald-400" />
            </div>
            <h2 className="text-white font-bold text-lg mb-1">Modo Paciente ativo!</h2>
            <p className="text-slate-400 text-sm">Você tem acesso completo à plataforma.</p>
            <Link href="/patient/diet" className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-2xl transition-all">
              Ver meu plano alimentar <ChevronRight size={14} />
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center pt-2"
            >
              <div className="w-16 h-16 bg-indigo-600/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Crown size={28} className="text-indigo-400" />
              </div>
              <h2 className="text-2xl font-light text-white">
                Modo <span className="font-black text-indigo-400">Paciente</span>
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
                Uma nutricionista no seu bolso. Dieta personalizada, receitas e suporte real.
              </p>
            </motion.div>

            {/* Plan toggle */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Escolha seu plano</p>
              <div className="space-y-3">
                {/* Annual */}
                <button
                  onClick={() => setSelectedPlan("annual")}
                  className={`w-full text-left p-4 rounded-3xl border transition-all relative overflow-hidden ${
                    selectedPlan === "annual"
                      ? "bg-indigo-600/20 border-indigo-500/50"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  {selectedPlan === "annual" && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-indigo-600/20 rounded-2xl flex items-center justify-center shrink-0">
                      <Zap size={18} className="text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-white font-bold text-sm">Plano Anual</span>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">Melhor valor</span>
                      </div>
                      <p className="text-indigo-300 font-black text-xl leading-none">R$47<span className="text-slate-400 text-sm font-normal">/ano</span></p>
                      <p className="text-slate-500 text-xs mt-0.5">R$3,92/mês · Economia de 60%</p>
                    </div>
                  </div>
                </button>

                {/* Monthly */}
                <button
                  onClick={() => setSelectedPlan("monthly")}
                  className={`w-full text-left p-4 rounded-3xl border transition-all relative overflow-hidden ${
                    selectedPlan === "monthly"
                      ? "bg-white/10 border-white/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  {selectedPlan === "monthly" && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-slate-500 rounded-full flex items-center justify-center">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center shrink-0">
                      <Calendar size={18} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm mb-0.5">Plano Mensal</p>
                      <p className="text-white font-black text-xl leading-none">R$97<span className="text-slate-400 text-sm font-normal">/mês</span></p>
                      <p className="text-slate-500 text-xs mt-0.5">Flexibilidade para cancelar</p>
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>

            {/* CTA button */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Link
                href="/patient/gateway"
                className="block w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-center font-bold rounded-2xl transition-all shadow-lg shadow-indigo-900/30"
              >
                {selectedPlan === "annual" ? "Assinar por R$47/ano" : "Assinar por R$97/mês"}
              </Link>
              <p className="text-center text-slate-600 text-xs mt-2">
                Fale com sua nutricionista para ativar
              </p>
            </motion.div>

            {/* Feature comparison */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              {/* Modo Paciente */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                    <Crown size={10} /> Modo Paciente
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="bg-indigo-600/5 border border-indigo-500/15 rounded-3xl p-4 space-y-3">
                  {PACIENTE_FEATURES.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-xl bg-indigo-600/15 flex items-center justify-center shrink-0">
                        <Icon size={13} className="text-indigo-400" />
                      </div>
                      <span className="text-slate-300 text-sm">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clube */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Sparkles size={10} /> Clube (incluído)
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-4 space-y-3">
                  {CLUBE_FEATURES.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3 opacity-70">
                      <div className="w-7 h-7 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        <Icon size={13} className="text-slate-400" />
                      </div>
                      <span className="text-slate-400 text-sm">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Consultation CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-amber-600/10 to-orange-600/5 border border-amber-500/20 rounded-3xl p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-500/15 rounded-2xl flex items-center justify-center shrink-0">
                  <Crown size={18} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm mb-0.5">Já é paciente?</p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Se você já comprou uma consulta ou o Método 90 Dias, peça para sua nutricionista ativar seu Modo Paciente.
                  </p>
                  <Link
                    href="/patient/professionals"
                    className="mt-3 inline-flex items-center gap-1.5 text-amber-400 text-xs font-bold"
                  >
                    Falar com a nutricionista <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* Lock reminder */}
            <div className="flex items-center gap-2 justify-center pb-4">
              <Lock size={12} className="text-slate-600" />
              <p className="text-slate-600 text-xs">Pagamento seguro · Cancele quando quiser</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
