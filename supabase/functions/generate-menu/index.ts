// ==================================================
// Supabase Edge Function: generate-menu
// Gera cardápio personalizado usando Gemini
// ==================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Interface do request
interface GenerateMenuRequest {
    user_id: string;
    focus: string; // Ex: "desinchar pós-festas"
    duration_days?: number;
}

// Interface da resposta OpenAI
interface MenuDay {
    day: number;
    title: string;
    tasks: Array<{
        time: string | null;
        type: 'meal' | 'shot' | 'workout' | 'content' | 'water';
        description: string;
        ingredients?: string[];
        points: number;
    }>;
}

serve(async (req) => {
    // CORS headers
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    try {
        // Parse request
        const { user_id, focus, duration_days = 7 }: GenerateMenuRequest = await req.json();

        if (!user_id || !focus) {
            return new Response(
                JSON.stringify({ error: 'Missing user_id or focus' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Criar cliente Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // 1. Buscar perfil do usuário para restrições alimentares
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('name, dietary_restrictions, primary_goal, current_weight, initial_weight')
            .eq('user_id', user_id)
            .single();

        if (profileError) {
            console.error('Erro ao buscar perfil:', profileError);
        }

        const restrictions = profile?.dietary_restrictions || [];
        const userName = profile?.name || 'Rainha';

        // 2. Buscar tenant para pegar GPT system prompt customizado
        const { data: tenant } = await supabase
            .from('tenants')
            .select('gpt_system_prompt, gpt_temperature')
            .eq('id', (await supabase.from('profiles').select('tenant_id').eq('user_id', user_id).single()).data?.tenant_id)
            .single();

        const systemPrompt = tenant?.gpt_system_prompt ||
            'Você é uma nutricionista anti-bullshit. Seja direta, use alimentos acessíveis e foque na biologia, não em modismos.';
        const temperature = tenant?.gpt_temperature || 0.7;

        // 3. Montar prompt para OpenAI
        const userPrompt = `
Crie um cardápio de ${duration_days} dias focado em: ${focus}

PERFIL DO USUÁRIO:
- Nome: ${userName}
- Restrições: ${restrictions.length > 0 ? restrictions.join(', ') : 'Nenhuma'}
- Objetivo: ${profile?.primary_goal || 'Não especificado'}

REGRAS CRÍTICAS:
1. Retorne APENAS JSON válido, sem markdown
2. Use alimentos acessíveis e do dia a dia brasileiro
3. Seja específica com quantidades e horários
4. Varie as refeições ao longo dos dias
5. Inclua shots matinais e dicas de hidratação
6. Tom: motivacional mas realista, sem promessas absurdas

FORMATO JSON ESPERADO:
{
  "title": "Título curto e motivacional",
  "description": "Descrição de 2-3 linhas explicando o foco",
  "days": [
    {
      "day": 1,
      "title": "Ex: Dia 1 - Despertar Metabólico",
      "tasks": [
        {
          "time": "08:00",
          "type": "shot",
          "description": "Descrição completa do shot",
          "ingredients": ["Item 1", "Item 2"],
          "points": 10
        },
        {
          "time": "09:00",
          "type": "meal",
          "description": "Descrição completa da refeição",
          "ingredients": ["Item 1", "Item 2"],
          "points": 30
        }
      ]
    }
  ]
}

TIPOS VÁLIDOS: shot, meal, workout, water, content
PONTOS: shot=10-20, meal=20-40, workout=30-50, water=10, content=5-10
`;

        // 4. Chamar Gemini
        const startTime = Date.now();

        const geminiResponse = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                generationConfig: { maxOutputTokens: 4000, responseMimeType: 'application/json' },
            }),
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            throw new Error(`Gemini error: ${JSON.stringify(errorData)}`);
        }

        const geminiData = await geminiResponse.json();
        const generationTime = Date.now() - startTime;

        // Parse JSON da IA (strip markdown fences)
        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const generatedContent = JSON.parse(cleanText);

        // 5. Calcular custo aproximado
        const inputTokens = 0;
        const tokensUsed = geminiData.usageMetadata?.totalTokenCount || 0;
        const costUsd = 0; // Gemini free tier // Claude Sonnet pricing

        // 6. Salvar log no banco
        const { data: logData, error: logError } = await supabase
            .from('ai_generations')
            .insert({
                user_id: user_id,
                tenant_id: (await supabase.from('profiles').select('tenant_id').eq('user_id', user_id).single()).data?.tenant_id,
                prompt_text: focus,
                focus: focus,
                duration_days: duration_days,
                user_profile_snapshot: profile,
                gpt_model: 'gemini-2.5-flash',
                gpt_temperature: temperature,
                system_prompt_used: systemPrompt,
                generated_content: generatedContent,
                tokens_used: tokensUsed,
                generation_time_ms: generationTime,
                cost_usd: costUsd,
                status: 'success',
            })
            .select()
            .single();

        if (logError) {
            console.error('Erro ao salvar log:', logError);
        }

        // 7. Retornar sucesso
        return new Response(
            JSON.stringify({
                success: true,
                data: generatedContent,
                metadata: {
                    generation_id: logData?.id,
                    tokens_used: tokensUsed,
                    cost_usd: costUsd,
                    generation_time_ms: generationTime,
                }
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            }
        );

    } catch (error) {
        console.error('Erro na Edge Function:', error);

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            }
        );
    }
});
