import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

export interface ContentTemplate {
    id: string
    created_at: string
    tenant_id: string | null
    name: string
    category: 'reminders' | 'check-ins' | 'motivational' | 'content' | 'challenges'
    event_type: 'push' | 'content' | 'challenge'
    title: string
    message?: string
    content_type?: string
    suggested_time: string
    usage_count: number
    is_favorite: boolean
    emoji: string
}

export function useContentTemplates(category?: string) {
    // supabase importado do singleton
    const [templates, setTemplates] = useState<ContentTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadTemplates = async () => {
        try {
            setLoading(true)
            setError(null)

            let query = supabase
                .from('content_templates')
                .select('*')
                .order('usage_count', { ascending: false })
                .order('name', { ascending: true })

            // Filtrar por categoria se especificado
            if (category) {
                query = query.eq('category', category)
            }

            const { data, error: fetchError } = await query

            if (fetchError) throw fetchError

            setTemplates(data || [])
        } catch (err: any) {
            console.error('Error loading templates:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadTemplates()
    }, [category])

    // Usar template (retorna dados para preencher formulário)
    const useTemplate = async (templateId: string) => {
        try {
            const template = templates.find(t => t.id === templateId)
            if (!template) throw new Error('Template not found')

            // Incrementar contador de uso
            await supabase
                .from('content_templates')
                .update({ usage_count: template.usage_count + 1 })
                .eq('id', templateId)

            // Atualizar localmente
            setTemplates(prev => prev.map(t =>
                t.id === templateId ? { ...t, usage_count: t.usage_count + 1 } : t
            ))

            return {
                event_type: template.event_type,
                title: template.title,
                message: template.message || '',
                content_type: template.content_type || 'diet',
                scheduled_time: template.suggested_time
            }
        } catch (err: any) {
            console.error('Error using template:', err)
            throw err
        }
    }

    // Marcar/desmarcar como favorito
    const toggleFavorite = async (templateId: string) => {
        try {
            const template = templates.find(t => t.id === templateId)
            if (!template) throw new Error('Template not found')

            const { error: updateError } = await supabase
                .from('content_templates')
                .update({ is_favorite: !template.is_favorite })
                .eq('id', templateId)

            if (updateError) throw updateError

            // Atualizar localmente
            setTemplates(prev => prev.map(t =>
                t.id === templateId ? { ...t, is_favorite: !t.is_favorite } : t
            ))
        } catch (err: any) {
            console.error('Error toggling favorite:', err)
            throw err
        }
    }

    // Criar novo template personalizado
    const createTemplate = async (templateData: Omit<ContentTemplate, 'id' | 'created_at' | 'tenant_id' | 'usage_count' | 'is_favorite'>) => {
        try {
            // Obter sessão do usuário (browser)
            const { data: { session }, error: authError } = await supabase.auth.getSession()

            if (authError || !session) {
                console.error('Auth check error:', authError)
                throw new Error('Você precisa estar logado para criar templates. Por favor, faça login novamente.')
            }

            const userId = session.user.id
            console.log('User session for template:', userId)

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('user_id', userId)
                .maybeSingle()

            if (profileError) {
                console.error('Profile fetch error:', profileError)
                throw new Error(`Erro ao buscar perfil: ${profileError.message}`)
            }

            if (!profile || !profile.tenant_id) {
                console.error('Profile or tenant_id missing:', profile)
                throw new Error('Perfil ou tenant não encontrado. Verifique sua conta.')
            }

            const { data, error: insertError } = await supabase
                .from('content_templates')
                .insert([{
                    ...templateData,
                    tenant_id: profile.tenant_id,
                    usage_count: 0,
                    is_favorite: false
                }])
                .select()
                .single()

            if (insertError) throw insertError

            // Adicionar na lista local
            setTemplates(prev => [...prev, data])

            return data
        } catch (err: any) {
            console.error('Error creating template:', err)
            throw err
        }
    }

    // Obter templates favoritos
    const favorites = templates.filter(t => t.is_favorite)

    // Obter templates mais usados
    const popular = templates.slice(0, 5)

    return {
        templates,
        favorites,
        popular,
        loading,
        error,
        useTemplate,
        toggleFavorite,
        createTemplate,
        refresh: loadTemplates
    }
}
