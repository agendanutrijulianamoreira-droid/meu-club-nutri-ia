import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { NUTRITIONIST_IDENTITY, TONE_LAYER } from '@/lib/ai-nutritionist-identity'

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
        const { focus, duration_days = 7 } = await request.json()
        if (!focus) return NextResponse.json({ error: 'focus is required' }, { status: 400 })

        const { data: profile } = await supabase
            .from('profiles')
            .select('name, tenant_id, dietary_restrictions, primary_goal, current_weight, initial_weight')
            .eq('user_id', user.id)
            .single()

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
        const systemPrompt = `${NUTRITIONIST_IDENTITY}\n\nPAPEL ESPECÍFICO — NUTRICIONISTA CRIADORA DE CARDÁPIOS:\nVocê cria planos alimentares para pacientes do ${tenantInfo?.brand_name || 'clube'} sob o método ${methodName}.\n${TONE_LAYER[tone] || TONE_LAYER['acolhedora']}\n${customPrompt ? `\nINSTRUÇÕES DO MÉTODO: ${customPrompt}` : ''}\nResponda APENAS com JSON válido, sem markdown.`

        const userPrompt = `Crie um cardápio de ${duration_days} dias focado em: ${focus}

PERFIL: ${patientName}, Restrições: ${restrictions.length > 0 ? restrictions.join(', ') : 'Nenhuma'}, Objetivo: ${profile?.primary_goal || '?'}, Peso: ${profile?.current_weight ? `${profile.current_weight}kg` : '?'}

FORMATO JSON:
{ "title": "Título", "description": "2 linhas", "days": [{ "day": 1, "title": "Dia 1 - Título", "tasks": [{ "time": "07:00", "type": "shot|meal|water|workout|content", "description": "Nome", "ingredients": ["item"], "points": 15 }] }] }`

        const generated = await callClaudeJSON({
            system: systemPrompt,
            maxTokens: 4000,
            messages: [{ role: 'user', content: userPrompt }],
        })

        await supabase.from('ai_generations').insert({
            user_id: user.id,
            tenant_id: profile?.tenant_id,
            prompt_text: focus,
            focus,
            duration_days,
            generated_content: generated,
            status: 'success',
        })

        return NextResponse.json({ success: true, data: generated })

    } catch (error: any) {
        console.error('[Meal Plan API] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
    }
}
