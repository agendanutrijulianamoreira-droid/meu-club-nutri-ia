import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { differenceInDays, startOfDay, parseISO } from 'date-fns'

/**
 * Retorna a data local do usuário no formato YYYY-MM-DD.
 * Usa o fuso do browser (que reflete o fuso do dispositivo).
 * Ex: às 23:00 BRT (02:00 UTC do dia seguinte), retorna o dia correto em BRT.
 */
function getLocalDate(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Retorna startOfDay usando a data LOCAL, não UTC.
 */
function localStartOfDay(): Date {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export interface PatientEngineData {
    loading: boolean
    activeProtocol: any
    currentDayItems: any[]
    progress: Record<string, boolean>
    stats: {
        currentDay: number
        totalDays: number
        completionRate: number
        totalPoints: number
        currentStreak: number
    }
    toggleCheckin: (
        itemId: string,
        currentStatus: boolean,
        proofType?: 'simple' | 'camera' | 'gallery',
        photoUrl?: string | null
    ) => Promise<void>
    refresh: () => Promise<void>
}

export function usePatientEngine(): PatientEngineData {
    const [loading, setLoading] = useState(true)
    const [activeProtocol, setActiveProtocol] = useState<any>(null)
    const [currentDayItems, setCurrentDayItems] = useState<any[]>([])
    const [progress, setProgress] = useState<Record<string, boolean>>({})
    const [stats, setStats] = useState({
        currentDay: 1,
        totalDays: 21,
        completionRate: 0,
        totalPoints: 0,
        currentStreak: 0
    })

    useEffect(() => {
        fetchDailyData()
    }, [])

    async function fetchDailyData() {
        try {
            setLoading(true)
            console.log('🔍 [PatientEngine] Iniciando busca de dados...')

            const { data: { user } } = await supabase.auth.getUser()
            console.log('👤 [PatientEngine] Usuário:', user?.id || 'NÃO AUTENTICADO')

            if (!user) {
                console.warn('⚠️ [PatientEngine] Sem usuário autenticado!')
                setLoading(false)
                return
            }

            // A. Buscar perfil do usuário para stats
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('nutri_coins, total_xp, current_streak')
                .eq('user_id', user.id)
                .single()

            if (userProfile) {
                setStats(prev => ({
                    ...prev,
                    totalPoints: userProfile.total_xp || 0,
                    currentStreak: userProfile.current_streak || 0,
                    nutriCoins: userProfile.nutri_coins || 0
                }))
            }

            // B. Buscar Atribuição Ativa (protocol_assignments)
            console.log('🔎 [PatientEngine] Buscando assignments para user:', user.id)
            const { data: assignments, error: assignError } = await supabase
                .from('protocol_assignments')
                .select(`
                    *,
                    protocol:protocols (*)
                `)
                .eq('user_id', user.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)

            console.log('📦 [PatientEngine] Assignments encontrados:', assignments)
            console.log('❌ [PatientEngine] Erro assignments:', assignError)

            const assignment = assignments?.[0]

            if (assignment && assignment.protocol) {
                // C. Calcular Dia Atual baseado na data de início
                // ⚡ TIMEZONE FIX: Usar data LOCAL, não UTC
                const todayLocal = localStartOfDay()
                const startDate = parseISO(assignment.start_date)
                const startLocal = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())

                const daysPassed = differenceInDays(todayLocal, startLocal)
                const currentDay = Math.max(1, daysPassed + 1)

                setActiveProtocol({
                    ...assignment.protocol,
                    assignmentId: assignment.id,
                    startDate: assignment.start_date
                })

                // D. Buscar dias do protocolo
                const { data: protocolDays } = await supabase
                    .from('protocol_days')
                    .select('id, day_number, title')
                    .eq('protocol_id', assignment.protocol.id)
                    .eq('day_number', currentDay)
                    .single()

                // E. Buscar itens do dia atual
                if (protocolDays) {
                    const { data: items } = await supabase
                        .from('protocol_items')
                        .select('*')
                        .eq('protocol_day_id', protocolDays.id)
                        .order('time', { ascending: true })

                    setCurrentDayItems(items || [])

                    // F. Buscar progresso de hoje (protocol_progress)
                    // ⚡ TIMEZONE FIX: Usar checkin_date (DATE puro) com data local
                    const todayStr = getLocalDate()
                    const { data: progressData } = await supabase
                        .from('protocol_progress')
                        .select('protocol_item_id, completed_at, checkin_date')
                        .eq('assignment_id', assignment.id)
                        .eq('checkin_date', todayStr) // ← DATE puro, sem timezone!

                    const progressMap: Record<string, boolean> = {}
                    progressData?.forEach((p: any) => {
                        progressMap[p.protocol_item_id] = true
                    })
                    setProgress(progressMap)

                    // G. Calcular taxa de conclusão
                    const totalItems = items?.length || 1
                    const completedItems = progressData?.length || 0
                    const completionRate = Math.round((completedItems / totalItems) * 100)

                    setStats(prev => ({
                        ...prev,
                        currentDay,
                        totalDays: assignment.protocol.duration_days || 21,
                        completionRate
                    }))
                } else {
                    setCurrentDayItems([])
                    setStats(prev => ({
                        ...prev,
                        currentDay,
                        totalDays: assignment.protocol.duration_days || 21,
                        completionRate: 0
                    }))
                }
            }
        } catch (error) {
            console.error('Erro no motor da paciente:', error)
        } finally {
            setLoading(false)
        }
    }

    async function toggleCheckin(
        itemId: string,
        currentStatus: boolean,
        proofType: 'simple' | 'camera' | 'gallery' = 'simple',
        photoUrl: string | null = null
    ) {
        if (!activeProtocol) return

        const newStatus = !currentStatus

        // Optimistic UI update
        setProgress(prev => ({ ...prev, [itemId]: newStatus }))

        try {
            // Escrita de XP centralizada no server (lib/services/gamification.ts) —
            // o client não chama mais a RPC increment_user_points diretamente, e o
            // valor de pontos por proof_type é resolvido lá a partir do protocol_item
            // (nunca aceito do client, ver nota no route.ts).
            const res = await fetch('/api/patient/protocol-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignment_id: activeProtocol.assignmentId,
                    protocol_item_id: itemId,
                    mark: newStatus,
                    proof_type: proofType,
                    photo_url: photoUrl,
                }),
            })
            if (!res.ok) throw new Error(`Falha ao salvar checkin (${res.status})`)
            const { points_delta } = await res.json()

            // Recalcular stats (progresso do dia + XP total exibido na Home)
            const totalItems = currentDayItems.length
            const completedCount = Object.values({ ...progress, [itemId]: newStatus }).filter(Boolean).length
            setStats(prev => ({
                ...prev,
                completionRate: Math.round((completedCount / totalItems) * 100),
                totalPoints: Math.max(0, prev.totalPoints + points_delta)
            }))

        } catch (error) {
            console.error('Erro ao salvar checkin:', error)
            // Reverter em caso de erro
            setProgress(prev => ({ ...prev, [itemId]: currentStatus }))
        }
    }

    return {
        loading,
        activeProtocol,
        currentDayItems,
        progress,
        stats,
        toggleCheckin,
        refresh: fetchDailyData
    }
}
