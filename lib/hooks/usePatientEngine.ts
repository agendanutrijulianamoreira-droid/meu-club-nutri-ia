import { useEffect, useState } from 'react'

function getLocalDate(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
        currentStreak: 0,
    })

    useEffect(() => {
        fetchDailyData()
    }, [])

    async function fetchDailyData() {
        try {
            setLoading(true)
            const response = await fetch(`/api/patient/home?date=${getLocalDate()}`, { cache: 'no-store' })
            if (!response.ok) throw new Error(`Falha ao carregar Home (${response.status})`)

            const payload = await response.json()
            const protocolData = payload.protocol
            const profile = payload.profile

            if (protocolData?.protocol) {
                setActiveProtocol({
                    ...protocolData.protocol,
                    assignmentId: protocolData.assignmentId,
                    startDate: protocolData.startDate,
                })
                setCurrentDayItems(protocolData.items || [])
                setProgress(protocolData.progress || {})
            } else {
                setActiveProtocol(null)
                setCurrentDayItems([])
                setProgress({})
            }

            setStats({
                currentDay: protocolData?.currentDay || 1,
                totalDays: protocolData?.protocol?.duration_days || 21,
                completionRate: protocolData?.completionRate || 0,
                totalPoints: profile?.total_xp || 0,
                currentStreak: profile?.current_streak || 0,
            })
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
        photoUrl: string | null = null,
    ) {
        if (!activeProtocol) return

        const newStatus = !currentStatus
        setProgress(prev => ({ ...prev, [itemId]: newStatus }))

        try {
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

            const totalItems = currentDayItems.length
            const completedCount = Object.values({ ...progress, [itemId]: newStatus }).filter(Boolean).length
            setStats(prev => ({
                ...prev,
                completionRate: totalItems ? Math.round((completedCount / totalItems) * 100) : 0,
                totalPoints: Math.max(0, prev.totalPoints + points_delta),
            }))
        } catch (error) {
            console.error('Erro ao salvar checkin:', error)
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
        refresh: fetchDailyData,
    }
}
