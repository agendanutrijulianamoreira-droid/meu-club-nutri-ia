// ==================================================
// Supabase Edge Function: analyze-plate
// Analisa fotos de pratos usando Gemini
// ==================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AnalyzePlateRequest {
    image_base64?: string;
    image_url?: string;
    user_id: string;
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
        const { image_base64, image_url, user_id }: AnalyzePlateRequest = await req.json();

        if (!user_id || (!image_base64 && !image_url)) {
            return new Response(
                JSON.stringify({ error: 'Missing user_id or image data' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Criar cliente Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // 1. Chamar Gemini
        const startTime = Date.now();

        // Prompt do usuário conforme solicitado
        const systemPrompt = "Você é um especialista em nutrição clínica. Analise imagens de pratos e forneça dados estruturados em JSON.";
        const userPrompt = `Analise este prato alimentar. Estime: calorias totais, gramas de proteína, carboidrato e gordura. Avalie se está adequado para uma pessoa em protocolo de inibidor de apetite com meta de 2000 kcal e 120g de proteína por dia (média de 400-500 kcal e 30g proteína por refeição). Dê feedback motivacional e uma sugestão de melhoria. Responda APENAS em JSON com campos: calorias, proteina, carboidrato, gordura, status (dentro_do_plano / acima / abaixo), feedback, sugestao.`;

        const geminiResponse = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: {
                'x-api-key': GEMINI_API_KEY!,
                                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gemini-2.5-flash',
                max_tokens: 1024,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: image_base64?.replace(/^data:image\/\w+;base64,/, '') || '',
                                },
                            },
                            {
                                type: 'text',
                                text: userPrompt
                            }
                        ]
                    }
                ],
            }),
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            throw new Error(`Gemini error: ${JSON.stringify(errorData)}`);
        }

        const geminiData = await geminiResponse.json();
        const generationTime = Date.now() - startTime;

        // Extrair JSON da resposta do Claude
        const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        if (!analysis) {
            throw new Error("Não foi possível extrair dados estruturados da análise.");
        }

        // 2. Salvar log no banco (tabela ai_generations já existe)
        await supabase
            .from('ai_generations')
            .insert({
                user_id: user_id,
                tenant_id: (await supabase.from('profiles').select('tenant_id').eq('user_id', user_id).single()).data?.tenant_id,
                prompt_text: "Plate Analysis",
                generated_content: analysis,
                gpt_model: 'gemini-2.5-flash',
                generation_time_ms: generationTime,
                status: 'success',
            });

        return new Response(
            JSON.stringify({ success: true, data: analysis }),
            { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );

    } catch (error) {
        console.error('Erro na Edge Function:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
    }
});
