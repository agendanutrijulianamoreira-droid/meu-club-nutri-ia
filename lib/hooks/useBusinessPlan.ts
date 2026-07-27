import { useState, useEffect, useCallback } from 'react'

export interface BusinessPlanItem {
  id: string
  plan_id: string
  month_id: string | null
  week_id: string | null
  club_tier: 'tech_diet' | 'vip' | 'both'
  item_type: 'challenge' | 'protocol' | 'content_post' | 'push_campaign' | 'email_campaign' | 'promotion' | 'product_launch' | 'special_event'
  title: string
  description: string | null
  linked_product_id: string | null
  status: 'pending_review' | 'approved' | 'edited' | 'rejected' | 'scheduled' | 'pushed'
  scheduled_for: string | null
  pushed_at: string | null
  edited_title: string | null
  edited_description: string | null
  owner_notes: string | null
}

export interface BusinessPlanWeek {
  id: string
  month_id: string
  week_number: number
  theme: string
  notes: string | null
  items: BusinessPlanItem[]
}

export interface BusinessPlanMonth {
  id: string
  plan_id: string
  month_number: number
  theme: string
  focus_area: string | null
  revenue_target_cents: number | null
  new_members_target: number | null
  notes: string | null
  weeks: BusinessPlanWeek[]
  items: BusinessPlanItem[]
}

export interface BusinessPlan {
  id: string
  tenant_id: string
  year: number
  title: string
  status: 'draft' | 'active' | 'archived'
  revenue_goal_cents: number | null
  questionnaire: Record<string, any>
  ai_summary: string | null
  created_at: string
}

export function useBusinessPlans() {
  const [plans, setPlans] = useState<BusinessPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/business-plan')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar planos')
      setPlans(data.plans || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createPlan = async (payload: {
    year: number; title: string; revenue_goal_cents?: number | null
    questionnaire?: Record<string, any>; ai_summary?: string
    months?: any[]
  }) => {
    const res = await fetch('/api/admin/business-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao criar plano')
    setPlans(prev => [data.plan, ...prev])
    return data.plan as BusinessPlan
  }

  const updatePlan = async (id: string, updates: Partial<BusinessPlan>) => {
    const res = await fetch(`/api/admin/business-plan/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar plano')
    setPlans(prev => prev.map(p => p.id === id ? data.plan : p))
    return data.plan as BusinessPlan
  }

  return { plans, loading, error, createPlan, updatePlan, refresh: load }
}

export function useBusinessPlanDetail(planId: string | null) {
  const [plan, setPlan] = useState<BusinessPlan | null>(null)
  const [months, setMonths] = useState<BusinessPlanMonth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!planId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/business-plan/${planId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar plano')
      setPlan(data.plan)
      setMonths(data.months || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => { load() }, [load])

  const updateItem = async (itemId: string, updates: Partial<BusinessPlanItem>) => {
    if (!planId) return
    const res = await fetch(`/api/admin/business-plan/${planId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar item')
    await load()
    return data.item as BusinessPlanItem
  }

  return { plan, months, loading, error, updateItem, refresh: load }
}
