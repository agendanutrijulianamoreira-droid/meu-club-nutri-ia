import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { NUTRITIONIST_IDENTITY, TONE_LAYER } from '@/lib/ai-nutritionist-identity'
import { sanitizeForPrompt, MealPlanSchema } from '@/lib/ai-security'

export async function POST(request: NextRequest) {
    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const focus = sanitizeForPrompt(body.focus, 500)
        const duration_days: number = Number(body.duration_days) || 7
        if (!focus) return NextResponse.json({ error: 'focus is required' }, { status: 400 })
        if (duration_days < 1 || duration_days > 30) return NextResponse.json({ error: 'duration_days must be 1–30' }, { status: 400 })

        const { data: profile } = await supabase
            .from('profiles')
            .select('name, tenant_id, dietary_restrictions, primary_goal, current_weight, initial_weight, current_plan')
            .eq('user_id', user.id)
            .single()

        // Determine plan tier
        const planTier: 'basic' | 'premium' = profile?.current_plan === 'vip' ? 'premium' : 'basic'

        let tenantInfo: any = null
        if (profile?.tenant_id) {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('brand_name, method_name, gpt_system_prompt, settings')
                .eq('id', profile.tenant_id)
                .single()
            tenantInfo = tenant
        }

        const restrictions: string[] = profile?.dietary_restrictions || []
        const patientName = profile?.name?.split(' ')[0] || 'Rainha'
        const methodName = tenantInfo?.method_name || 'Protocolo Nutri'
        const tone = tenantInfo?.settings?.ai?.tone || 'motivadora'
        const customPrompt = tenantInfo?.gpt_system_prompt || ''

        // Build tier-specific prompt suffix
        const tierPrompt = planTier === 'premium'
            ? `\nMODO CALCULADO: Inclua para cada refeição: kcal, protein_g, carbs_g, fat_g e lista de itens com gramas.
Inclua 2 substituições por ingrediente principal.
Retorne JSON: { "title": "...", "total_kcal_day": 1800, "days": [{ "day": 1, "total_kcal": 1800, "total_protein_g": 120, "total_carbs_g": 180, "total_fat_g": 60, "meals": [{ "name": "...", "kcal": 400, "protein_g": 30, "carbs_g": 45, "fat_g": 12, "items": [{ "food": "Ovos", "quantity_g": 120, "quantity_label": "2 unidades" }], "substitutions": [{ "ingredient": "Ovos", "option_1": "Tofu firme 150g", "option_2": "Atum em lata 100g" }] }] }] }`
            : `\nMODO QUALITATIVO: Não inclua gramas exatas, calorias ou macros nos cardápios.
Escreva de forma descritiva e acolhedora, como uma amiga nutricionista conversando.
Cada refeição deve ter: nome, uma descrição de 1-2 frases com os alimentos, e uma dica motivacional curta.
Use linguagem calorosa: "Uma opção deliciosa...", "Que tal experimentar...", "Você vai adorar..."
Retorne JSON: { "title": "...", "days": [{ "day": 1, "meals": [{ "name": "Café da manhã", "description": "Uma combinação deliciosa de...", "tip": "Dica motivacional curta" }] }] }`

        const systemPrompt = `${NUTRITIONIST_IDENTITY}\n\nPAPEL ESPECÍFICO — NUTRICIONISTA CRIADORA DE CARDÁPIOS:\nVocê cria planos alimentares para pacientes do ${tenantInfo?.brand_name || 'clube'} sob o método ${methodName}.\n${TONE_LAYER[tone] || TONE_LAYER['acolhedora']}\n${customPrompt ? `\nINSTRUÇÕES DO MÉTODO: ${customPrompt}` : ''}${tierPrompt}\nResponda APENAS com JSON válido, sem markdown.`

        const userPrompt = planTier === 'premium'
            ? `Crie um cardápio calculado de ${duration_days} dias focado em: ${focus}

PERFIL: ${patientName}, Restrições: ${restrictions.length > 0 ? restrictions.join(', ') : 'Nenhuma'}, Objetivo: ${profile?.primary_goal || '?'}, Peso: ${profile?.current_weight ? `${profile.current_weight}kg` : '?'}

Inclua macros completos (kcal, proteína, carboidratos, gorduras) para cada refeição e para o total do dia.
Para os ingredientes principais de cada refeição, forneça 2 opções de substituição equivalente.`
            : `Crie um cardápio qualitativo de ${duration_days} dias focado em: ${focus}

PERFIL: ${patientName}, Restrições: ${restrictions.length > 0 ? restrictions.join(', ') : 'Nenhuma'}, Objetivo: ${profile?.primary_goal || '?'}

Escreva de forma acolhedora e motivacional, sem números exatos de gramas ou calorias.
Cada refeição deve ter um nome, uma descrição deliciosa e uma dica motivacional.`

        const raw = await callClaudeJSON({
            system: systemPrompt,
            maxTokens: 4000,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const generated = MealPlanSchema.parse(raw)

        await supabase.from('ai_generations').insert({
            user_id: user.id,
            tenant_id: profile?.tenant_id,
            prompt_text: focus,
            focus,
            duration_days,
            generated_content: generated,
            status: 'success',
        })

        return NextResponse.json({ success: true, data: generated, tier: planTier, planType: profile?.current_plan || 'community' })

    } catch (error: any) {
        console.error('[Meal Plan API] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
    }
}
