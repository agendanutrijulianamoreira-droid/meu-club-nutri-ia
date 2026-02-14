import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

export interface ScheduledEvent {
    id: string
    created_at: string
    updated_at: string
    tenant_id: string
    scheduled_date: string
    scheduled_time: string
    event_type: 'push' | 'content' | 'challenge'
    title: string
    message?: string
    content_type?: 'diet' | 'recipe' | 'video' | 'pdf' | 'shot' | 'article'
    protocol_id?: string
    status: 'scheduled' | 'sent' | 'cancelled'
    sent_at?: string
    metadata?: Record<string, any>
    recurrence_id?: string
}

export interface CreateEventData {
    scheduled_date: string
    scheduled_time: string
    event_type: 'push' | 'content' | 'challenge'
    title: string
    message?: string
    content_type?: string
    protocol_id?: string
    metadata?: Record<string, any>
    recurrence_id?: string
}

export function useScheduledEvents(month: number, year: number) {

    // supabase importado do singleton
    const [events, setEvents] = useState<ScheduledEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Carregar eventos do mês
    const loadEvents = async () => {
        try {
            setLoading(true)
            setError(null)

            // Calcular primeiro e último dia do mês
            const firstDay = new Date(year, month, 1).toISOString().split('T')[0]
            const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0]

            const { data, error: fetchError } = await supabase
                .from('scheduled_events')
                .select('*')
                .gte('scheduled_date', firstDay)
                .lte('scheduled_date', lastDay)
                .order('scheduled_date', { ascending: true })
                .order('scheduled_time', { ascending: true })

            if (fetchError) throw fetchError

            setEvents(data || [])
        } catch (err: any) {
            console.error('Error loading scheduled events:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadEvents()
    }, [month, year])

    // Criar novo evento
    const createEvent = async (eventData: CreateEventData) => {
        try {
            // Obter sessão do usuário (mais resiliente no browser)
            const { data: { session }, error: authError } = await supabase.auth.getSession()

            if (authError) {
                console.error('Auth check error:', authError)
                throw new Error(`Erro de conexão com autenticação: ${authError.message}`)
            }

            const user = session?.user
            if (!user) {
                console.error('No session found')
                throw new Error('Sessão expirada ou não encontrada. Por favor, faça login novamente.')
            }

            console.log('User session found:', user.id)

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('user_id', user.id)
                .maybeSingle()

            if (profileError) {
                console.error('Profile fetch error:', profileError)
                throw new Error(`Erro ao buscar perfil: ${profileError.message}`)
            }

            if (!profile || !profile.tenant_id) {
                console.error('Profile or tenant_id missing:', profile)
                throw new Error('Perfil de nutricionista não encontrado ou incompleto.')
            }

            console.log('Using tenant_id:', profile.tenant_id)

            const { data, error: insertError } = await supabase
                .from('scheduled_events')
                .insert([{
                    ...eventData,
                    tenant_id: profile.tenant_id,
                    status: 'scheduled'
                }])
                .select()
                .single()

            if (insertError) {
                console.error('Insert error details:', insertError)

                if (insertError.code === '42P01') {
                    throw new Error('Banco de dados incompleto (tabela scheduled_events ausente).')
                }
                throw new Error(`Erro ao salvar no banco: ${insertError.message}`)
            }

            console.log('Event created:', data.id)

            // Adicionar na lista local
            setEvents(prev => [...prev, data].sort((a, b) => {
                if (a.scheduled_date === b.scheduled_date) {
                    return a.scheduled_time.localeCompare(b.scheduled_time)
                }
                return a.scheduled_date.localeCompare(b.scheduled_date)
            }))

            return data
        } catch (err: any) {
            console.error('Detailed createEvent error:', err)
            throw err
        }
    }

    // Criar múltiplos eventos (Bulk)
    const createEvents = async (eventsData: CreateEventData[]) => {
        try {
            const { data: { session }, error: authError } = await supabase.auth.getSession()
            if (authError || !session?.user) throw new Error('Sessão expirada ou não encontrada.')

            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('user_id', session.user.id)
                .maybeSingle()

            if (!profile?.tenant_id) throw new Error('Tenant não encontrado.')

            // Fallback seguro para randomUUID em contextos não-seguros
            const recurrenceId = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

            const preparedEvents = eventsData.map(ev => ({
                ...ev,
                tenant_id: profile.tenant_id,
                status: 'scheduled',
                recurrence_id: recurrenceId
            }))

            const { data, error: insertError } = await supabase
                .from('scheduled_events')
                .insert(preparedEvents)
                .select()

            if (insertError) throw insertError

            // Adicionar todos na lista local e re-ordenar
            setEvents(prev => [...prev, ...data].sort((a, b) => {
                if (a.scheduled_date === b.scheduled_date) {
                    return a.scheduled_time.localeCompare(b.scheduled_time)
                }
                return a.scheduled_date.localeCompare(b.scheduled_date)
            }))

            return data
        } catch (err: any) {
            console.error('Error in createEvents:', err)
            throw err
        }
    }

    // Atualizar evento individual
    const updateEvent = async (id: string, updates: Partial<CreateEventData>) => {
        try {
            const { data, error: updateError } = await supabase
                .from('scheduled_events')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (updateError) throw updateError

            // Atualizar na lista local
            setEvents(prev => prev.map(e => e.id === id ? data : e))

            return data
        } catch (err: any) {
            console.error('Error updating event:', err)
            throw err
        }
    }

    // Atualizar todos os eventos de uma recorrência (Bulk Update)
    const updateRecurringEvents = async (recurrenceId: string, updates: Partial<CreateEventData>) => {
        try {
            const { data, error: updateError } = await supabase
                .from('scheduled_events')
                .update(updates)
                .eq('recurrence_id', recurrenceId)
                .select()

            if (updateError) throw updateError

            // Atualizar na lista local
            setEvents(prev => {
                const updatedDataMap = new Map(data.map((d: any) => [d.id, d]))
                return prev.map(e => updatedDataMap.has(e.id) ? updatedDataMap.get(e.id) : e)
            })

            return data
        } catch (err: any) {
            console.error('Error updating recurring events:', err)
            throw err
        }
    }

    // Deletar evento
    const deleteEvent = async (id: string) => {
        try {
            const { error: deleteError } = await supabase
                .from('scheduled_events')
                .delete()
                .eq('id', id)

            if (deleteError) throw deleteError

            // Remover da lista local
            setEvents(prev => prev.filter(e => e.id !== id))
        } catch (err: any) {
            console.error('Error deleting event:', err)
            throw err
        }
    }

    // Deletar todos os eventos de uma recorrência (Bulk Delete)
    const deleteRecurringEvents = async (recurrenceId: string) => {
        try {
            const { error: deleteError } = await supabase
                .from('scheduled_events')
                .delete()
                .eq('recurrence_id', recurrenceId)

            if (deleteError) throw deleteError

            // Remover da lista local
            setEvents(prev => prev.filter(e => e.recurrence_id !== recurrenceId))
        } catch (err: any) {
            console.error('Error deleting recurring events:', err)
            throw err
        }
    }

    // Duplicar evento para outra data
    const duplicateEvent = async (id: string, newDate: string) => {
        try {
            const originalEvent = events.find(e => e.id === id)
            if (!originalEvent) throw new Error('Event not found')

            const { id: _, created_at, updated_at, sent_at, status, tenant_id, ...eventData } = originalEvent

            const duplicatedData: CreateEventData = {
                ...eventData,
                scheduled_date: newDate
            }

            return await createEvent(duplicatedData)
        } catch (err: any) {
            console.error('Error duplicating event:', err)
            throw err
        }
    }

    return {
        events,
        loading,
        error,
        createEvent,
        createEvents,
        updateEvent,
        updateRecurringEvents,
        deleteEvent,
        deleteRecurringEvents,
        duplicateEvent,
        refresh: loadEvents
    }
}
