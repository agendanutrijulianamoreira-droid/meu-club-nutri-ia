'use server';

import { callClaudeJSON } from "@/lib/services/anthropic";
import { checkAndConsumeCredit } from "@/lib/ai-credits";

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
export async function generateClinicalContent(prompt: string, type: 'protocol' | 'challenge' | 'persona' | 'club_plan' | 'club_setup', tenantId?: string) {
    try {
        // === VERIFICAÇÃO DE CRÉDITOS IA ===
        if (tenantId) {
            const creditResult = await checkAndConsumeCredit(tenantId, type, `Geração de ${type}: ${prompt.substring(0, 50)}...`)
            if (!creditResult.success) {
                return {
                    success: false,
                    error: creditResult.error || 'Créditos de IA esgotados.',
                    creditsExhausted: true,
                    credits_remaining: creditResult.credits_remaining ?? 0
                }
            }
            console.log(`[generateAI] Crédito consumido. Restantes: ${creditResult.credits_remaining}`)
        }

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            console.error('[generateAI] GEMINI_API_KEY não configurada')
            return { success: false, error: "Chave da API não configurada no servidor." }
        }

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
            ` : type === 'club_plan' ? `
            OBJETIVO: Criar um Planejamento Semestral ou Anual para o Clube de Assinatura.
            O usuário informará o nicho, público e duração (6 ou 12 meses).
            
            FORMATO JSON ESPERADO (Array de Meses):
            [
                {
                    "month": 1,
                    "monthName": "Janeiro",
                    "theme": "Tema do mês (Ex: Detox Pós-Festas)",
                    "protocol_title": "Nome do Protocolo Alimentar (Ex: Protocolo Reset)",
                    "challenge_title": "Nome do Desafio (Ex: Desafio 7 Dias Sem Açúcar)",
                    "inbox_templates": [
                        "Mensagem de abertura do mês (com emoji e tom adequado)",
                        "Mensagem de meio de mês (motivação)",
                        "Mensagem de encerramento/preparação próx mês"
                    ],
                    "upgrade_cta": "Call to action para um serviço extra (consulta, exame, e-book)"
                }
            ]
            ` : type === 'club_setup' ? `
            OBJETIVO: Criar o Setup Completo do Clube (Persona + Estratégia + Planejamento).
            O usuário informará apenas o nicho/temática.
            
            FORMATO JSON ESPERADO:
            {
                "niche": "Nicho atrativo",
                "targetAudience": "Quem é o cliente ideal?",
                "biggestPain": "O que mais dói nelas?",
                "mainGoal": "A promessa do clube",
                "toneOfVoice": "Acolhedor, técnico ou motivacional",
                "pillars": "3 pilares do seu método",
                "format": "Mentoria em grupo, Desafios mensais ou Aulas gravadas?",
                "plan_draft": [
                    { "month": 1, "theme": "...", "challenge": "..." },
                    { "month": 2, "theme": "...", "challenge": "..." },
                    { "month": 3, "theme": "...", "challenge": "..." },
                    { "month": 4, "theme": "...", "challenge": "..." },
                    { "month": 5, "theme": "...", "challenge": "..." },
                    { "month": 6, "theme": "...", "challenge": "..." }
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

        const data = await callClaudeJSON({
            system: systemInstruction,
            maxTokens: 4000,
            messages: [{ role: 'user', content: prompt }],
        })

        return { success: true, data, error: null }

    } catch (error: any) {
        console.error("[generateAI] Erro:", error)
        return { success: false, error: error.message || "Erro ao gerar conteúdo com IA" }
    }
}
