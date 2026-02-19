'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Helper para limpar o JSON retornado pela IA (remove markdown blocks)
 */
function sanitizeJSON(text: string) {
    if (!text) return "";
    return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

/**
 * Server Action para gerar conteúdo clínico com Gemini.
 * Roda no servidor Next.js — sem CORS, sem timeout de Edge Function.
 */
export async function generateClinicalContent(prompt: string, type: 'protocol' | 'challenge' | 'persona') {
    try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            console.error('[generateAI] GEMINI_API_KEY falhou: Chave não configurada')
            return { success: false, error: "Chave da API não configurada no servidor." }
        }

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                responseMimeType: "application/json"
            }
        })

        const systemInstruction = `
            Você é um assistente especialista em nutrição, marketing e negócios para saúde B2B.
            Você está criando conteúdo para uma Nutricionista que usa a plataforma "Meu Club Nutri".
            O tom de voz deve ser profissional, estratégico mas acolhedor.
            
            REGRAS OBRIGATÓRIAS:
            - Retorne APENAS JSON válido, sem markdown.
            - Use linguagem brasileira (pt-BR).
            - Seja criativo mas realista.
            
            ${type === 'persona' ? `
            OBJETIVO: Criar uma "Persona de Clube" baseada no NICHO informado.
            FORMATO JSON ESPERADO:
            {
                "niche": "Nicho refinado e atrativo",
                "targetAudience": "Descrição detalhada do público-alvo (dores, desejos, faixa etária)",
                "biggestPain": "A dor nº 1 que tira o sono desse público",
                "mainGoal": "A grande promessa/transformação do clube",
                "toneOfVoice": "3 adjetivos que definem a marca + breve explicação"
            }
            ` : type === 'protocol' ? `
            FORMATO DO PROTOCOLO:
            {
                "title": "Nome do Protocolo",
                "description": "Descrição motivacional (2-3 frases)",
                "category": "detox|lowcarb|challenge|custom",
                "days": [
                    {
                        "day_number": 1,
                        "title": "Dia 1: Nome",
                        "items": [
                            {
                                "time": "08:00",
                                "type": "shot|meal|workout|content",
                                "title": "Título do item",
                                "description": "Descrição detalhada",
                                "is_mandatory": true/false,
                                "points": 10-50
                            }
                        ]
                    }
                ]
            }
            ` : `
            FORMATO DO DESAFIO:
            {
                "title": "Nome do Desafio",
                "description": "Descrição motivacional",
                "duration_days": 7,
                "rules": ["Regra 1", "Regra 2"],
                "daily_tasks": [
                    {
                        "day": 1,
                        "task": "Tarefa do dia",
                        "points": 20
                    }
                ],
                "prize": "Descrição do prêmio"
            }
            `}
        `

        const result = await model.generateContent(`${systemInstruction}\n\nO pedido do usuário é: ${prompt}`)
        const responseText = result.response.text()

        if (!responseText) throw new Error("IA não retornou texto")

        const cleanedText = sanitizeJSON(responseText)

        try {
            const data = JSON.parse(cleanedText)
            return { success: true, data, error: null }
        } catch (parseError) {
            console.error("Falha ao fazer parse do JSON da IA:", responseText)
            return { success: false, error: "A IA devolveu um formato inválido. Tente novamente." }
        }

    } catch (error: any) {
        console.error("[generateAI] Erro:", error)
        return { success: false, error: error.message || "Erro ao gerar conteúdo com IA" }
    }
}
