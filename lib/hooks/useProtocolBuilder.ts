// Protocol Builder Hooks - Hierarquia completa
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ==========================================
// TYPES
// ==========================================

export interface ProtocolItem {
    id: string
    protocol_day_id: string
    time: string | null
    type: 'meal' | 'shot' | 'workout' | 'content' | 'water' | 'custom'
    title: string
    description: string | null
    ingredients: string[] | null
    recipe: string | null
    video_url: string | null
    is_mandatory: boolean
    points: number
    order_index: number
}

export interface ProtocolDay {
    id: string
    protocol_id: string
    day_number: number
    title: string
    subtitle: string | null
    items?: ProtocolItem[]
}

export interface ProtocolFull {
    id: string
    title: string
    description: string | null
    duration_days: number
    cover_image_url: string | null
    category: string
    status: string
    is_active: boolean
    created_at: string
    start_date?: string | null
    start_time?: string | null
    end_date?: string | null
    auto_activate?: boolean
    scheduled_status?: string
    days?: ProtocolDay[]
}

// ==========================================
// HOOK: useProtocolBuilder
// ==========================================

export function useProtocolBuilder(protocolId?: string) {
    const [protocol, setProtocol] = useState<ProtocolFull | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Carregar protocolo completo (com dias e items)
    const loadProtocol = async (id: string) => {
        try {
            setLoading(true)

            // 1. Carregar protocolo
            const { data: protocolData, error: protocolError } = await supabase
                .from('protocols')
                .select('*')
                .eq('id', id)
                .single()

            if (protocolError) throw protocolError

            // 2. Carregar dias
            const { data: daysData, error: daysError } = await supabase
                .from('protocol_days')
                .select('*')
                .eq('protocol_id', id)
                .order('day_number')

            if (daysError) throw daysError

            // 3. Carregar items de cada dia
            const daysWithItems = await Promise.all(
                (daysData || []).map(async (day) => {
                    const { data: items } = await supabase
                        .from('protocol_items')
                        .select('*')
                        .eq('protocol_day_id', day.id)
                        .order('order_index')

                    return { ...day, items: items || [] }
                })
            )

            setProtocol({
                ...protocolData,
                days: daysWithItems
            })
        } catch (err) {
            console.error('Error loading protocol:', err)
        } finally {
            setLoading(false)
        }
    }

    // Salvar protocolo completo (criar ou atualizar)
    const saveProtocol = async (data: {
        title: string
        description: string
        duration_days: number
        cover_image_url?: string
        category: string
        start_date?: string | null
        start_time?: string | null
        auto_activate?: boolean
        days: Array<{
            day_number: number
            title: string
            subtitle?: string
            items: Array<{
                time?: string
                type: string
                title: string
                description?: string
                ingredients?: string[]
                recipe?: string
                video_url?: string
                is_mandatory?: boolean
                points?: number
                order_index?: number
            }>
        }>
    }) => {
        try {
            setSaving(true)

            // 1. Salvar/Atualizar protocolo
            let protocol_id = protocolId

            if (protocol_id) {
                // Update
                const { error } = await supabase
                    .from('protocols')
                    .update({
                        title: data.title,
                        description: data.description,
                        duration_days: data.duration_days,
                        cover_image_url: data.cover_image_url,
                        category: data.category,
                        start_date: data.start_date,
                        start_time: data.start_time,
                        auto_activate: data.auto_activate
                    })
                    .eq('id', protocol_id)

                if (error) throw error

                // Deletar dias antigos (cascade vai deletar items também)
                await supabase
                    .from('protocol_days')
                    .delete()
                    .eq('protocol_id', protocol_id)
            } else {
                // Create
                const { data: newProtocol, error } = await supabase
                    .from('protocols')
                    .insert([{
                        title: data.title,
                        description: data.description,
                        duration_days: data.duration_days,
                        cover_image_url: data.cover_image_url,
                        category: data.category,
                        start_date: data.start_date,
                        start_time: data.start_time,
                        auto_activate: data.auto_activate,
                        scheduled_status: data.start_date ? 'scheduled' : 'draft',
                        is_active: false,
                        tenant_id: null
                    }])
                    .select()
                    .single()

                if (error) throw error
                protocol_id = newProtocol.id
            }

            // 2. Salvar dias e items
            for (const day of data.days) {
                const { data: dayData, error: dayError } = await supabase
                    .from('protocol_days')
                    .insert([{
                        protocol_id,
                        day_number: day.day_number,
                        title: day.title,
                        subtitle: day.subtitle
                    }])
                    .select()
                    .single()

                if (dayError) throw dayError

                // 3. Salvar items do dia
                if (day.items.length > 0) {
                    const items = day.items.map((item, idx) => ({
                        protocol_day_id: dayData.id,
                        time: item.time || null,
                        type: item.type,
                        title: item.title,
                        description: item.description || null,
                        ingredients: item.ingredients || null,
                        recipe: item.recipe || null,
                        video_url: item.video_url || null,
                        is_mandatory: item.is_mandatory ?? true,
                        points: item.points || 10,
                        order_index: item.order_index ?? idx
                    }))

                    const { error: itemsError } = await supabase
                        .from('protocol_items')
                        .insert(items)

                    if (itemsError) throw itemsError
                }
            }

            return { success: true, protocol_id }
        } catch (err: any) {
            console.error('Error saving protocol:', err)
            return { success: false, error: err.message }
        } finally {
            setSaving(false)
        }
    }

    // Duplicar protocolo (usando função SQL)
    const duplicateProtocol = async (id: string) => {
        try {
            const { data, error } = await supabase.rpc('duplicate_protocol', {
                p_protocol_id: id
            })

            if (error) throw error
            return { success: true, new_id: data }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    }

    // Carregar ao montar se tiver ID
    useEffect(() => {
        if (protocolId) {
            loadProtocol(protocolId)
        }
    }, [protocolId])

    return {
        protocol,
        loading,
        saving,
        saveProtocol,
        duplicateProtocol,
        reload: () => protocolId && loadProtocol(protocolId)
    }
}

// ==========================================
// HOOK: useAIWriter (Mock por enquanto)
// ==========================================

export function useAIWriter() {
    const [generating, setGenerating] = useState(false)

    const generateDescription = async (title: string, category: string) => {
        setGenerating(true)

        // Mock - depois conectar com OpenAI/Gemini
        await new Promise(resolve => setTimeout(resolve, 2000))

        const descriptions: Record<string, string> = {
            'detox': `🌿 Bem-vinda ao ${title}, Rainha! Prepare-se para despertar sua energia vital e renovar seu corpo de dentro para fora. Nesta jornada de transformação, você vai eliminar toxinas, reenergizar suas células e redescobrir o poder da alimentação consciente. Cada dia é um passo em direção à sua melhor versão. Vamos juntas? 👑✨`,
            'lowcarb': `💪 O ${title} é sua porta de entrada para um metabolismo acelerado e uma energia estável. Vamos reduzir carboidratos estrategicamente enquanto aumentamos gorduras boas e proteínas de qualidade. O resultado? Menos inchaço, mais foco mental e o corpo que você sempre quis. Suas refeições nunca mais serão as mesmas, Rainha! 🔥`,
            'maintenance': `⚖️ ${title}: o equilíbrio perfeito entre prazer e saúde. Chegou a hora de manter suas conquistas sem abrir mão do que você ama. Aqui, você vai aprender a fazer escolhas conscientes, honrar seu corpo e criar hábitos que duram para sempre. Manutenção não é restrição, é liberdade com sabedoria. 🌸`,
            'custom': `✨ O ${title} foi criado especialmente para você, Rainha! Este protocolo une ciência, nutrição e autoconhecimento para te guiar em uma jornada única de transformação. Cada dia foi pensado com carinho para que você alcance seus objetivos de forma sustentável e prazerosa. Prepare-se para resultados reais! 💎`
        }

        const description = descriptions[category] || descriptions['custom']

        setGenerating(false)
        return description
    }

    return { generateDescription, generating }
}
