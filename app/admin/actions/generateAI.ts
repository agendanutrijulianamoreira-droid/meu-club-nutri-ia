'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Server Action para gerar conteúdo clínico com Gemini.
 * Roda no servidor Next.js — sem CORS, sem timeout de Edge Function.
 */
export async function generateClinicalContent(prompt: string, type: 'protocol' | 'challenge') {
    try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            console.warn('[generateAI] GEMINI_API_KEY not set, using mock')
            return generateMockContent(prompt, type)
        }

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                responseMimeType: "application/json"
            }
        })

        const systemInstruction = `
            Você é um assistente especialista em nutrição para saúde da mulher.
            Você está criando conteúdo para o app de uma Nutricionista especialista em SOP, Endometriose e Reprogramação Hormonal.
            O tom de voz deve ser sábio, sem neuras, acolhedor e focado em resolver problemas reais.
            
            REGRAS:
            - Retorne APENAS JSON válido, sem markdown.
            - Use linguagem brasileira (pt-BR).
            - Seja específico com ingredientes e quantidades.
            - Inclua emojis nos títulos para engajamento.
            
            ${type === 'protocol' ? `
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

        return { success: true, data: JSON.parse(responseText), error: null }

    } catch (error: any) {
        console.error("[generateAI] Erro:", error)
        // Fallback para mock se a IA falhar
        return generateMockContent(prompt, type)
    }
}

/**
 * Mock generator para quando não tem API key ou a IA falhar.
 * Gera conteúdo estático de qualidade para testes.
 */
function generateMockContent(prompt: string, type: 'protocol' | 'challenge') {
    if (type === 'challenge') {
        return {
            success: true,
            error: null,
            data: {
                title: "🔥 Desafio Desincha em 7 Dias",
                description: "7 dias intensos para eliminar inchaço, regular o intestino e despertar sua energia. Sem radicalismo, com ciência!",
                duration_days: 7,
                rules: [
                    "Completar pelo menos 3 tarefas por dia",
                    "Postar foto do seu shot matinal no grupo",
                    "Dormir até 23h por pelo menos 5 dos 7 dias"
                ],
                daily_tasks: Array.from({ length: 7 }, (_, i) => ({
                    day: i + 1,
                    task: [
                        "Shot de limão + gengibre em jejum + 2L de água",
                        "Eliminar açúcar refinado e trocar por frutas",
                        "Incluir 3 porções de vegetais verdes no dia",
                        "Caminhada de 20min ao ar livre",
                        "Jantar leve até 19h (sopa ou salada)",
                        "Chá anti-inflamatório antes de dormir",
                        "Dia de celebração: registre sua evolução!"
                    ][i],
                    points: [20, 25, 30, 35, 30, 25, 40][i]
                })),
                prize: "🏆 Badge 'Guerreira Desinchada' + 200 Nutri Coins"
            }
        }
    }

    // Mock para protocolo
    const duration = parseInt(prompt.match(/(\d+)\s*dias?/i)?.[1] || '7')
    return {
        success: true,
        error: null,
        data: {
            title: "✨ Protocolo Equilíbrio Hormonal",
            description: "Protocolo personalizado para regular hormônios, desinchar e devolver energia. Cada dia é um passo para a sua melhor versão, Rainha! 👑",
            category: "challenge",
            days: Array.from({ length: duration }, (_, i) => ({
                day_number: i + 1,
                title: `Dia ${i + 1}: ${['Despertar', 'Fortalecimento', 'Renovação', 'Energia', 'Equilíbrio', 'Clareza', 'Celebração'][i % 7]}`,
                items: [
                    {
                        time: "08:00",
                        type: "shot",
                        title: "🍋 Shot Anti-inflamatório",
                        description: "200ml de água morna + suco de 1 limão + 2cm gengibre ralado + pitada de cúrcuma",
                        is_mandatory: true,
                        points: 20
                    },
                    {
                        time: "09:00",
                        type: "meal",
                        title: "☀️ Café da Manhã Funcional",
                        description: i % 2 === 0
                            ? "Omelete de 2 ovos com espinafre + 1/2 abacate + café sem açúcar"
                            : "Panqueca de aveia com frutas vermelhas + iogurte natural",
                        is_mandatory: true,
                        points: 30
                    },
                    {
                        time: "12:30",
                        type: "meal",
                        title: "🥗 Almoço Colorido",
                        description: "Proteína magra (frango/peixe) + salada verde + legumes grelhados + azeite",
                        is_mandatory: true,
                        points: 40
                    },
                    {
                        time: "17:00",
                        type: "workout",
                        title: i % 2 === 0 ? "🏃‍♀️ HIIT 20min" : "🚶‍♀️ Caminhada 30min",
                        description: i % 2 === 0
                            ? "20 minutos de treino intervalado (30s intenso + 30s descanso)"
                            : "Caminhada ao ar livre em ritmo moderado",
                        is_mandatory: false,
                        points: i % 2 === 0 ? 50 : 40
                    },
                    {
                        time: "19:00",
                        type: "meal",
                        title: "🌙 Jantar Leve",
                        description: "Sopa de legumes ou salada com proteína. Priorize alimentos de fácil digestão.",
                        is_mandatory: true,
                        points: 30
                    }
                ]
            }))
        }
    }
}
