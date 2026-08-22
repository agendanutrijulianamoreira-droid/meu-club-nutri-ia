import { useEffect, useMemo, useState } from 'react'
import { usePatientHomeData } from '@/components/patient/PatientHomeDataProvider'

const EMPTY_ITEMS: any[] = []
const EMPTY_PROGRESS: Record<string, boolean> = {}

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
    const { payload, loading, refresh, readOnly, localDate } = usePatientHomeData()
    const protocolData = payload?.protocol
    const profile = payload?.profile

    const baseActiveProtocol = useMemo(() => protocolData?.protocol ? ({
        ...protocolData.protocol,
        assignmentId: protocolData.assignmentId,
        startDate: protocolData.startDate,
    }) : null, [protocolData])

    const baseItems = protocolData?.items ?? EMPTY_ITEMS
    const baseProgress = protocolData?.progress ?? EMPTY_PROGRESS

    const [progress, setProgress] = useState<Record<string, boolean>>({})
    const [stats, setStats] = useState({
        currentDay: 1,
        totalDays: 21,
        completionRate: 0,
        totalPoints: 0,
        currentStreak: 0,
    })

    useEffect(() => {
        setProgress(baseProgress)
        setStats({
            currentDay: protocolData?.currentDay || 1,
            totalDays: protocolData?.protocol?.duration_days || 21,
            completionRate: protocolData?.completionRate || 0,
            totalPoints: profile?.total_xp || 0,
            currentStreak: profile?.current_streak || 0,
        })
    }, [baseProgress, protocolData, profile])

    async function toggleCheckin(
        itemId: string,
        currentStatus: boolean,
        proofType: 'simple' | 'camera' | 'gallery' = 'simple',
        photoUrl: string | null = null,
    ) {
        if (readOnly || !baseActiveProtocol) return

        const newStatus = !currentStatus
        setProgress(prev => ({ ...prev, [itemId]: newStatus }))

        try {
            const res = await fetch('/api/patient/protocol-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignment_id: baseActiveProtocol.assignmentId,
                    protocol_item_id: itemId,
                    mark: newStatus,
                    proof_type: proofType,
                    photo_url: photoUrl,
                    local_date: localDate,
                }),
            })
            if (!res.ok) throw new Error(`Falha ao salvar checkin (${res.status})`)
            const { points_delta } = await res.json()

            const totalItems = baseItems.length
            const completedCount = Object.values({ ...progress, [itemId]: newStatus }).filter(Boolean).length
            setStats(prev => ({
                ...prev,
                completionRate: totalItems ? Math.round((completedCount / totalItems) * 100) : 0,
                totalPoints: Math.max(0, prev.totalPoints + points_delta),
            }))

            await refresh()
        } catch (error) {
            console.error('Erro ao salvar checkin:', error)
            setProgress(prev => ({ ...prev, [itemId]: currentStatus }))
        }
    }

    return {
        loading,
        activeProtocol: baseActiveProtocol,
        currentDayItems: baseItems,
        progress,
        stats,
        toggleCheckin,
        refresh,
    }
}
