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
        .select('brand_name, method_name, club_audience, club_goal, club_frequency, club_tone, club_upgrades, club_restrictions, club_top_themes')
        .eq('id', profile.tenant_id)
        .single()

    const monthCount = planType === 'semestral' ? 6 : 12
    const now = new Date()
    const startMonth = now.getMonth() // 0-indexed

    // Parse wizard inputs for personalization
    const audience = tenant?.club_audience || ''
    const goal = tenant?.club_goal || ''
    const tone = tenant?.club_tone || ''
    const upgrades = tenant?.club_upgrades || ''
    const topThemes = tenant?.club_top_themes || ''
    const methodName = tenant?.method_name || 'Método Exclusivo'
    const brandName = tenant?.brand_name || 'Clube'

    // Smart themes: prioritize user's top themes, then fill with defaults
    const userThemes = topThemes.split(',').map((t: string) => t.trim()).filter(Boolean)
    const defaultThemes = [
        'Detox & Renovação', 'Energia & Vitalidade', 'Imunidade & Proteção',
        'Beleza de Dentro pra Fora', 'Performance & Metabolismo', 'Equilíbrio Hormonal',
        'Anti-Inflamatório', 'Saúde Intestinal', 'Emagrecimento Inteligente',
        'Longevidade & Anti-Age', 'Mindful Eating', 'Super Alimentos'
    ]
    // Merge: user themes first, then fill remaining with defaults (no duplicates)
    const allThemes = [...userThemes]
    for (const dt of defaultThemes) {
        if (allThemes.length >= 12) break
        if (!allThemes.some(t => t.toLowerCase() === dt.toLowerCase())) allThemes.push(dt)
    }
    while (allThemes.length < 12) allThemes.push(defaultThemes[allThemes.length % defaultThemes.length])

    // Smart challenges: contextualize with audience & goal
    const audienceTag = audience ? ` para ${audience.split(',')[0]?.trim()}` : ''
    const defaultChallenges = [
        `Desafio 21 Dias Sem Açúcar${audienceTag}`, `Desafio Hidratação 3L/dia`, `Desafio Sono Reparador`,
        `Desafio Proteína em Todas as Refeições`, `Desafio Meditação + Nutrição`, `Desafio Fibras & Intestino`,
        `Desafio Antioxidantes${audienceTag}`, `Desafio Receitas Funcionais`, `Desafio Movimento Diário`,
        `Desafio Suplementação Consciente`, `Desafio Mindful Eating`, `Desafio Gratidão & Saúde`
    ]

    // Smart upsells: use user's upgrades if available
    const userUpgrades = upgrades.split(',').map((u: string) => u.trim()).filter(Boolean)
    const defaultUpgrades = [
        'Upgrade para Plano VIP com Consulta Individual',
        'Teste Genético NutriGen ✨',
        'Kit Suplementos Premium 💊',
        'Grupo Exclusivo de Mentoria',
        'Programa Detox Premium',
        'Masterclass de Nutrição Avançada',
        'Avaliação Corporal Completa',
        'Acompanhamento Semanal Personalizado',
        'E-book Exclusivo do Método',
        'Evento Presencial VIP',
        'Programa Intensivo 90 Dias',
        'Consultoria de Nutrição Funcional'
    ]
    const allUpgrades = userUpgrades.length > 0
        ? [...userUpgrades, ...defaultUpgrades].slice(0, 12)
        : defaultUpgrades

    // Tone prefix for inbox messages
    const toneEmoji = tone.includes('Acolhedor') ? '💜' : tone.includes('Direto') ? '⚡' : tone.includes('Técnico') ? '🧬' : '🌸'

    // Generate plan with personalized content
    const months: MonthPlan[] = []

    for (let i = 0; i < monthCount; i++) {
        const monthIndex = (startMonth + i) % 12
        const theme = allThemes[i % allThemes.length]
        const challenge = defaultChallenges[monthIndex]
        months.push({
            month: monthIndex + 1,
            monthName: MONTH_NAMES[monthIndex],
            theme,
            protocol_title: `Protocolo ${theme} — ${methodName}`,
            challenge_title: challenge,
            inbox_templates: [
                `${toneEmoji} ${MONTH_NAMES[monthIndex]}: Mês de ${theme}! ${goal ? `Foco: ${goal.split(',')[0]?.trim()}` : 'Preparada para sua transformação?'}`,
                `💪 Lembrete: O ${challenge} começa amanhã! Quem está dentro?`,
                `🏆 Metade do mês no ${brandName}! Continue firme no protocolo.`
            ],
            upgrade_cta: `${allUpgrades[i % allUpgrades.length]}`
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
