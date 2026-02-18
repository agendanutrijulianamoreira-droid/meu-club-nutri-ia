'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

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

export async function generateClubPlan(planType: 'semestral' | 'anual') {
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
        .select('brand_name, method_name')
        .eq('id', profile.tenant_id)
        .single()

    const monthCount = planType === 'semestral' ? 6 : 12
    const now = new Date()
    const startMonth = now.getMonth() // 0-indexed

    // Generate plan with AI-like structured logic (no external API dependency for MVP)
    const months: MonthPlan[] = []

    const themes = [
        'Detox & Renovação', 'Energia & Vitalidade', 'Imunidade & Proteção',
        'Beleza de Dentro pra Fora', 'Performance & Metabolismo', 'Equilíbrio Hormonal',
        'Anti-Inflamatório', 'Saúde Intestinal', 'Emagrecimento Inteligente',
        'Longevidade & Anti-Age', 'Mindful Eating', 'Super Alimentos'
    ]

    const challenges = [
        'Desafio 21 Dias Sem Açúcar', 'Desafio Hidratação 3L/dia', 'Desafio Jejum Intermitente',
        'Desafio Sono Reparador', 'Desafio Proteína em Todas as Refeições', 'Desafio Meditação + Nutrição',
        'Desafio Fibras & Intestino', 'Desafio Antioxidantes', 'Desafio Movimento Diário',
        'Desafio Suplementação Consciente', 'Desafio Receitas Funcionais', 'Desafio Gratidão & Saúde'
    ]

    const upgradeCtas = [
        'Ofereça o Teste Genético NutriGen ✨', 'Upgrade para Plano VIP com Consulta Individual',
        'Lance o Kit Suplementos Premium 💊', 'Convide para o Grupo Exclusivo de Mentoria',
        'Ofereça o Programa Detox Premium', 'Lance a Masterclass de Nutrição Avançada',
        'Ofereça Avaliação Corporal Completa', 'Upgrade para Plano com Acompanhamento Semanal',
        'Lance o E-book Exclusivo do Método', 'Convite VIP para Evento Presencial',
        'Ofereça o Programa Intensivo 90 Dias', 'Promoção Black Friday Fitness + Nutri'
    ]

    for (let i = 0; i < monthCount; i++) {
        const monthIndex = (startMonth + i) % 12
        months.push({
            month: monthIndex + 1,
            monthName: MONTH_NAMES[monthIndex],
            theme: themes[monthIndex],
            protocol_title: `Protocolo ${themes[monthIndex]} - ${tenant?.method_name || 'Método Exclusivo'}`,
            challenge_title: challenges[monthIndex],
            inbox_templates: [
                `📢 ${MONTH_NAMES[monthIndex]}: Mês de ${themes[monthIndex]}! Preparada para sua transformação?`,
                `💪 Lembrete: O ${challenges[monthIndex]} começa amanhã! Quem está dentro?`,
                `🏆 Parabéns! Metade do mês alcançada. Continue firme no protocolo!`
            ],
            upgrade_cta: upgradeCtas[monthIndex]
        })
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
