import { supabase } from './supabase'
import { addMonths, startOfMonth, format } from 'date-fns'

export interface SetupData {
    name: string
    specialty: string
    methodName: string
    archetype: string
    tone: string
    niche: string
}

const TEMPLATES = {
    emagrecimento: {
        events: [
            { title: "Detox de Janeiro: Reinício Real", month: 0, description: "Foco em desinflamação e limpeza hepática pós-festas." },
            { title: "Desafio 15 Dias: Seca Barriga", month: 1, description: "Protocolo intensivo para reduzir medidas rapidamente." },
            { title: "Páscoa Sem Culpa: Estratégia Doce", month: 2, description: "Como aproveitar sem perder os resultados conquistados." },
            { title: "Abril: Modulação Intestinal", month: 3, description: "Foco total na saúde do intestino e absorção de nutrientes." },
            { title: "Maio: Equilíbrio Hormonal", month: 4, description: "Estratégias para controle de cortisol e insulina." },
            { title: "Junho: Foco Termogênico", month: 5, description: "Acelerando o metabolismo no inverno." },
            { title: "Julho: Detox de Inverno", month: 6, description: "Sopas e caldos nutritivos para manter o peso." },
            { title: "Agosto: Definição Muscular", month: 7, description: "Aumento de aporte proteico e tônus muscular." },
            { title: "Setembro: Renovação Metabólica", month: 8, description: "Quebra de platô com janelas de jejum estratégico." },
            { title: "Outubro: Projeto Verão On", month: 9, description: "Intensificação de queima de gordura." },
            { title: "Novembro: Lapidação Final", month: 10, description: "Foco em retenção hídrica e definição." },
            { title: "Dezembro: Estratégia de Festas", month: 11, description: "Guia de sobrevivência para o Natal e Ano Novo." }
        ],
        checkins: [
            { id: 1, text: "Seguiu o plano alimentar ontem?", type: "boolean" },
            { id: 2, text: "Nível de energia hoje (0-10)?", type: "scale" },
            { id: 3, text: "Bebeu pelo menos 2L de água?", type: "boolean" },
            { id: 4, text: "Teve algum episódio de compulsão?", type: "boolean" }
        ]
    },
    hipertrofia: {
        events: [
            { title: "Janeiro: Superávit Controlado", month: 0, description: "Início do ganho de massa com baixo acúmulo de gordura." },
            { title: "Desafio Creatina: Força Máxima", month: 1, description: "Protocolo de saturação e ganho de força." },
            { title: "Março: Protocolo Hipertrofia 360", month: 2, description: "Foco em volume de treino e densidade calórica." },
            { title: "Abril: Saúde Mitocondrial", month: 3, description: "Otimizando a energia celular para treinos intensos." },
            { title: "Maio: Peak Performance", month: 4, description: "Ajuste fino de macronutrientes." }
        ],
        checkins: [
            { id: 1, text: "Bateu a meta de proteína hoje?", type: "boolean" },
            { id: 2, text: "Treinou hoje con qualidade?", type: "boolean" },
            { id: 3, text: "Sentiu pump muscular?", type: "scale" }
        ]
    }
}

export async function generateInitialSystem(data: SetupData) {
    try {
        const { name, specialty, methodName, archetype, tone, niche } = data

        // 1. Get current tenant (assuming one for now as per migrations)
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .limit(1)
            .single()

        if (!tenant) throw new Error("Tenant não encontrado")

        // 2. Select Template
        const template = TEMPLATES[niche as keyof typeof TEMPLATES] || TEMPLATES.emagrecimento
        const currentYear = new Date().getFullYear()

        // 3. Update Tenant Settings
        const { error: tenantError } = await supabase
            .from('tenants')
            .update({
                name: name || 'Meu Reino',
                method_name: methodName,
                ai_tone: tone,
                niche: niche,
                method_phases: [
                    { id: 1, name: 'Fase 1: Desinflamação', locked: false },
                    { id: 2, name: 'Fase 2: Modulação', locked: true },
                    { id: 3, name: 'Fase 3: Estilo de Vida', locked: true }
                ],
                checkin_config: {
                    frequency: "weekly",
                    questions: template.checkins
                },
                settings: {
                    onboarding_completed: true,
                    archetype: archetype,
                    specialty: specialty
                }
            })
            .eq('id', tenant.id)

        if (tenantError) throw tenantError

        // 4. Generate Protocols (Annual Plan)
        // We'll create them as 'scheduled' protocols
        const protocolPromises = template.events.map(async (evt, i) => {
            const startDate = startOfMonth(addMonths(new Date(currentYear, 0, 1), evt.month))
            const isActive = i === new Date().getMonth()

            const { data: protocol, error: pError } = await supabase
                .from('protocols')
                .insert({
                    title: evt.title,
                    description: evt.description,
                    duration_days: 7, // Default 7 days for the demo
                    is_active: isActive,
                    is_template: false,
                    scheduled_status: isActive ? 'active' : 'scheduled',
                    start_date: format(startDate, 'yyyy-MM-dd')
                })
                .select()
                .single()

            if (pError) throw pError

            // 5. Seed Days for the Active Protocol
            if (isActive && protocol) {
                const { data: day, error: dError } = await supabase
                    .from('protocol_days')
                    .insert({
                        protocol_id: protocol.id,
                        day_number: 1,
                        title: 'Dia 1: Reinício Metabólico'
                    })
                    .select()
                    .single()

                if (dError) throw dError

                if (day) {
                    await supabase.from('protocol_items').insert([
                        { protocol_day_id: day.id, time: '08:00', type: 'shot', title: 'Shot Matinal Anti-oxi', description: 'Limão, cúrcuma e pimenta preta', points: 20, order_index: 0 },
                        { protocol_day_id: day.id, time: '09:00', type: 'meal', title: 'Desjejum Proteico', description: 'Ovos mexidos com abacate', points: 30, order_index: 1 },
                        { protocol_day_id: day.id, time: '12:00', type: 'meal', title: 'Almoço Funcional', description: 'Peixe grelhado com legumes no vapor', points: 30, order_index: 2 },
                        { protocol_day_id: day.id, time: '20:00', type: 'content', title: 'Leitura da Noite', description: 'Mentalidade Rainha: O segredo da constância', points: 10, order_index: 3 }
                    ])
                }
            }
        })

        await Promise.all(protocolPromises)

        return { success: true }
    } catch (error) {
        console.error("Setup Engine Error:", error)
        return { success: false, error }
    }
}
