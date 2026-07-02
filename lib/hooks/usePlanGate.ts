'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'

// Feature matrix — which plans unlock which features
const PLAN_FEATURES: Record<string, string[]> = {
  community: ['feed', 'checkin', 'store', 'ranking', 'chat_basic', 'protocols_view'],
  tech_diet: ['feed', 'checkin', 'store', 'ranking', 'chat_basic', 'protocols_view', 'meal_plan_ai', 'chat_unlimited', 'gateway'],
  vip: ['feed', 'checkin', 'store', 'ranking', 'chat_basic', 'protocols_view', 'meal_plan_ai', 'diet_premium', 'chat_unlimited', 'gateway', 'appointments', 'vip_content', 'plate_analysis_ai'],
}

const PLAN_ORDER = ['community', 'tech_diet', 'vip']

export type PlanFeature =
  | 'feed'
  | 'checkin'
  | 'store'
  | 'ranking'
  | 'chat_basic'
  | 'chat_unlimited'
  | 'protocols_view'
  | 'meal_plan_ai'
  | 'diet_premium'
  | 'gateway'
  | 'appointments'
  | 'vip_content'
  | 'plate_analysis_ai'

interface PlanGateResult {
  allowed: boolean
  loading: boolean
  currentPlan: string | null
  minPlan: string | null
}

/**
 * Returns whether the current patient can access a given feature.
 *
 * Usage:
 *   const { allowed, loading, minPlan } = usePlanGate('meal_plan_ai')
 *   if (!allowed) return <PlanUpgradePrompt requiredPlan={minPlan} />
 */
export function usePlanGate(feature: PlanFeature): PlanGateResult {
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !mounted) { setLoading(false); return }
      supabase
        .from('profiles')
        .select('current_plan')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (mounted) {
            setCurrentPlan(data?.current_plan ?? 'community')
            setLoading(false)
          }
        })
    })
    return () => { mounted = false }
  }, [])

  // Find the minimum plan that grants access
  const minPlan = PLAN_ORDER.find(plan =>
    (PLAN_FEATURES[plan] ?? []).includes(feature)
  ) ?? null

  const allowed = !loading && currentPlan != null &&
    (PLAN_FEATURES[currentPlan] ?? []).includes(feature)

  return { allowed, loading, currentPlan, minPlan }
}

/**
 * Server-side helper (no hook) — checks a plan string against a feature.
 * Use in API routes or RSC where you already have the plan string.
 */
export function planAllows(plan: string | null | undefined, feature: PlanFeature): boolean {
  return (PLAN_FEATURES[plan ?? 'community'] ?? []).includes(feature)
}
