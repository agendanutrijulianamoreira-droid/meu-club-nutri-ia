'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { z } from 'zod'

interface MonthPlan {
    month: number
    monthName: string
    theme: string
    protocol_title: string
    challenge_title: string
    inbox_templates: string[]
    upgrade_cta: string
}

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const planTypeSchema = z.enum(['semestral', 'anual'], { error: 'Tipo de plano inválido' })

const monthPlanSchema = z.object({
    month: z.number().min(1).max(12),
    monthName: z.string(),
    theme: z.string().min(1),
    protocol_title: z.string().min(1),
    challenge_title: z.string().min(1),
    inbox_templates: z.array(z.string()),
    upgrade_cta: z.string()
})

import { generateClinicalContent } from './generateAI'

export async function generateClubPlan(planType: 'semestral' | 'anual') {
    const parsed = planTypeSchema.safeParse(planType)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Tipo inválido' }

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()

    if (!profile?.tenant_id) return { error: 'Tenant não encontrado' }

    const { data: tenant } = await supabase
        .from('tenants')
        .select('brand_name, method_name, club_audience, club_goal, club_frequency, club_tone, club_upgrades, club_restrictions, club_top_themes')
        .eq('id', profile.tenant_id)
        .single()

    const monthCount = planType === 'semestral' ? 6 : 12
    const now = new Date()
    const startMonth = now.getMonth() // 0-indexed

    // Parse wizard inputs for personalization
    const audience = tenant?.club_audience || 'Mulheres em busca de saúde'
    const goal = tenant?.club_goal || 'Melhorar alimentação e energia'
    const tone = tenant?.club_tone || 'Motivador e acolhedor'
    const niche = tenant?.club_top_themes || 'Emagrecimento e Saúde da Mulher'

    // P0 Review Fix: Real AI Generation
    const prompt = `
    Crie um planejamento ${planType} (${monthCount} meses) para um clube de assinatura de nutrição.
    
    NICHO: ${niche}
    PÚBLICO-ALVO: ${audience}
    OBJETIVO DO CLUBE: ${goal}
    TOM DE VOZ: ${tone}
    
    O plano deve começar no mês ${startMonth + 1} (mês atual ou próximo).
    Gere exatamente ${monthCount} meses.
    `

    const aiResult = await generateClinicalContent(prompt, 'club_plan')

    let months: MonthPlan[] = []

    if (aiResult.success && aiResult.data && Array.isArray(aiResult.data)) {
        // Validate AI response against schema
        const validated = z.array(monthPlanSchema).safeParse(aiResult.data)
        if (validated.success) {
            months = validated.data
        } else {
            console.error("AI Plan Validation Failed:", validated.error)
            // Fallback? No, user wants real AI or error. Let's return error to be honest.
            return { error: "A IA gerou um formato inválido. Tente novamente." }
        }
    } else {
        return { error: aiResult.error || "Falha ao gerar plano com IA." }
    }

    // Save to DB
    const { data: existing } = await supabase
        .from('club_plans')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('plan_type', planType)
        .single()

    if (existing) {
        await supabase
            .from('club_plans')
            .update({ months: JSON.stringify(months), updated_at: new Date().toISOString() })
            .eq('id', existing.id)
    } else {
        await supabase
            .from('club_plans')
            .insert({
                tenant_id: profile.tenant_id,
                plan_type: planType,
                months: JSON.stringify(months)
            })
    }

    return { success: true, months }
}

export async function saveClubPlan(planType: 'semestral' | 'anual', months: MonthPlan[]) {
    const parsedType = planTypeSchema.safeParse(planType)
    if (!parsedType.success) return { error: 'Tipo de plano inválido' }
    const parsedMonths = z.array(monthPlanSchema).min(1).safeParse(months)
    if (!parsedMonths.success) return { error: 'Dados dos meses inválidos' }

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()

    if (!profile?.tenant_id) return { error: 'Tenant não encontrado' }

    const { data: existing } = await supabase
        .from('club_plans')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('plan_type', planType)
        .single()

    if (existing) {
        await supabase
            .from('club_plans')
            .update({ months: JSON.stringify(months), updated_at: new Date().toISOString() })
            .eq('id', existing.id)
    } else {
        await supabase
            .from('club_plans')
            .insert({
                tenant_id: profile.tenant_id,
                plan_type: planType,
                months: JSON.stringify(months)
            })
    }

    return { success: true }
}

export async function loadClubPlan(planType: 'semestral' | 'anual') {
    const parsedType = planTypeSchema.safeParse(planType)
    if (!parsedType.success) return { error: 'Tipo de plano inválido', months: null }

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado', months: null }

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()

    if (!profile?.tenant_id) return { error: 'Tenant não encontrado', months: null }

    const { data: plan } = await supabase
        .from('club_plans')
        .select('months, updated_at')
        .eq('tenant_id', profile.tenant_id)
        .eq('plan_type', planType)
        .single()

    if (!plan) return { error: null, months: null }

    const months = typeof plan.months === 'string' ? JSON.parse(plan.months) : plan.months
    return { error: null, months, updatedAt: plan.updated_at }
}
