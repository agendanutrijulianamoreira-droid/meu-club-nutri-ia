// Hooks para gerenciar dados do Supabase
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

// ==========================================
// PROTOCOLS
// ==========================================

export interface Protocol {
    id: string
    tenant_id: string | null
    title: string
    description: string | null
    cover_image_url?: string | null
    duration_days: number
    content: any[]
    content_json?: any[] | null
    category?: string
    status?: string
    is_active: boolean
    is_favorite: boolean
    created_at: string
}

export function useProtocols() {
    const [protocols, setProtocols] = useState<Protocol[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchProtocols = async (category?: string) => {
        try {
            setLoading(true)
            let query = supabase
                .from('protocols')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (category) {
                query = query.eq('category', category)
            }

            const { data, error } = await query

            if (error) throw error
            setProtocols(data || [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const createProtocol = async (protocol: Omit<Protocol, 'id' | 'created_at'>) => {
        try {
            const { data, error } = await supabase
                .from('protocols')
                .insert([protocol])
                .select()
                .single()

            if (error) throw error

            // Atualizar lista local
            setProtocols(prev => [data, ...prev])
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const updateProtocol = async (id: string, updates: Partial<Protocol>) => {
        try {
            const { data, error } = await supabase
                .from('protocols')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            // Atualizar lista local
            setProtocols(prev => prev.map(p => p.id === id ? data : p))
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const deleteProtocol = async (id: string) => {
        try {
            const { error } = await supabase
                .from('protocols')
                .delete()
                .eq('id', id)

            if (error) throw error

            // Remover da lista local
            setProtocols(prev => prev.filter(p => p.id !== id))
            return { error: null }
        } catch (err: any) {
            return { error: err.message }
        }
    }

    const duplicateProtocol = async (id: string) => {
        try {
            const { data, error } = await supabase.rpc('duplicate_protocol', {
                p_protocol_id: id
            })

            if (error) throw error

            fetchProtocols()
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const toggleFavorite = async (id: string) => {
        const protocol = protocols.find(p => p.id === id)
        if (!protocol) return
        const { error } = await supabase
            .from('protocols')
            .update({ is_favorite: !protocol.is_favorite })
            .eq('id', id)
        if (!error) {
            setProtocols(prev => prev.map(p => p.id === id ? { ...p, is_favorite: !p.is_favorite } : p))
        }
    }

    useEffect(() => {
        fetchProtocols()
    }, [])

    return {
        protocols,
        loading,
        error,
        createProtocol,
        updateProtocol,
        deleteProtocol,
        duplicateProtocol,
        toggleFavorite,
        refresh: fetchProtocols
    }
}

// ==========================================
// GOALS (Metas)
// ==========================================

export interface Goal {
    id: string
    tenant_id: string
    title: string
    description: string | null
    emoji: string
    goal_type: 'weight' | 'habit' | 'nutrition' | 'exercise' | 'wellness' | 'custom'
    metric: string | null
    target_value: number | null
    unit: string | null
    deadline: string | null
    is_active: boolean
    is_favorite: boolean
    content_json: any
    created_at: string
}

export function useGoals(tenantId?: string) {
    const [goals, setGoals] = useState<Goal[]>([])
    const [loading, setLoading] = useState(true)

    const fetchGoals = async () => {
        if (!tenantId) { setLoading(false); return }
        setLoading(true)
        const { data, error } = await supabase
            .from('goals')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(50)
        if (!error) setGoals(data || [])
        setLoading(false)
    }

    const createGoal = async (goal: Omit<Goal, 'id' | 'created_at'>) => {
        try {
            const { data, error } = await supabase
                .from('goals')
                .insert([goal])
                .select()
                .single()
            if (error) throw error
            setGoals(prev => [data, ...prev])
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const deleteGoal = async (id: string) => {
        try {
            const { error } = await supabase.from('goals').delete().eq('id', id)
            if (error) throw error
            setGoals(prev => prev.filter(g => g.id !== id))
            return { error: null }
        } catch (err: any) {
            return { error: err.message }
        }
    }

    const toggleGoalFavorite = async (id: string) => {
        const goal = goals.find(g => g.id === id)
        if (!goal) return
        const { error } = await supabase
            .from('goals')
            .update({ is_favorite: !goal.is_favorite })
            .eq('id', id)
        if (!error) setGoals(prev => prev.map(g => g.id === id ? { ...g, is_favorite: !g.is_favorite } : g))
    }

    useEffect(() => { fetchGoals() }, [tenantId])

    return { goals, loading, createGoal, deleteGoal, toggleGoalFavorite, refresh: fetchGoals }
}

// ==========================================
// CHALLENGES
// ==========================================

export interface Challenge {
    id: string
    tenant_id: string | null
    title: string
    description: string | null
    emoji: string
    duration_days: number
    start_date: string | null
    end_date: string | null
    is_active: boolean
    prize_pool_coins: number
    entry_fee_coins: number
    max_participants: number | null
    rewards_json: any
    created_at: string
}

export function useChallenges() {
    const [challenges, setChallenges] = useState<Challenge[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchChallenges = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('challenges')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            setChallenges(data || [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const createChallenge = async (challenge: Omit<Challenge, 'id' | 'created_at'>) => {
        try {
            const { data, error } = await supabase
                .from('challenges')
                .insert([challenge])
                .select()
                .single()

            if (error) throw error
            setChallenges(prev => [data, ...prev])
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const updateChallenge = async (id: string, updates: Partial<Challenge>) => {
        try {
            const { data, error } = await supabase
                .from('challenges')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            setChallenges(prev => prev.map(c => c.id === id ? data : c))
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const deleteChallenge = async (id: string) => {
        try {
            const { error } = await supabase
                .from('challenges')
                .delete()
                .eq('id', id)

            if (error) throw error
            setChallenges(prev => prev.filter(c => c.id !== id))
            return { error: null }
        } catch (err: any) {
            return { error: err.message }
        }
    }

    useEffect(() => {
        fetchChallenges()
    }, [])

    return {
        challenges,
        loading,
        error,
        createChallenge,
        updateChallenge,
        deleteChallenge,
        refresh: fetchChallenges
    }
}

// ==========================================
// PATIENTS (PROFILES)
// ==========================================

export interface Patient {
    id: string
    user_id: string
    tenant_id: string | null
    role: string
    full_name: string | null
    avatar_url: string | null
    objective: string | null
    created_at: string
    // Stats joined
    total_points?: number
    current_streak?: number
    last_checkin_date?: string
}

export function usePatients() {
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchPatients = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    *,
                    user_stats (
                        total_points,
                        current_streak,
                        last_checkin_date
                    )
                `)
                .eq('role', 'patient')
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error

            // Flatten the stats
            const flattened = (data || []).map((p: any) => ({
                ...p,
                total_points: p.user_stats?.[0]?.total_points || 0,
                current_streak: p.user_stats?.[0]?.current_streak || 0,
                last_checkin_date: p.user_stats?.[0]?.last_checkin_date || null
            }))

            setPatients(flattened)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPatients()
    }, [])

    return {
        patients,
        loading,
        error,
        refresh: fetchPatients
    }
}

// ==========================================
// TENANT (Club Settings)
// ==========================================

export interface Tenant {
    id: string
    brand_name: string
    slug: string
    brand_color: string
    method_name?: string
    gpt_system_prompt?: string | null
    logo_url: string | null
    plan_tier?: string | null
    settings: any
    created_at: string
}

export function useTenant(tenantId?: string) {
    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchTenant = async () => {
        if (!tenantId) {
            setLoading(false)
            return
        }
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', tenantId)
                .single()

            if (error) throw error
            setTenant(data)
        } catch (err) {
            console.error('Error fetching tenant:', err)
        } finally {
            setLoading(false)
        }
    }

    const updateTenant = async (id: string, updates: Partial<Tenant>) => {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            setTenant(data)
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    useEffect(() => {
        fetchTenant()
    }, [tenantId])

    return {
        tenant,
        loading,
        updateTenant,
        refresh: fetchTenant
    }
}
// ==========================================
// ASSIGNMENTS
// ==========================================

export interface Assignment {
    id: string
    protocol_id: string
    user_id: string
    status: 'active' | 'completed' | 'paused' | 'expired'
    start_date: string
    assigned_at?: string
    progress_percentage: number
    created_at: string
    // Joined data
    protocol?: Protocol
}

export function useAssignments(userId?: string) {
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [loading, setLoading] = useState(true)

    const fetchAssignments = async () => {
        if (!userId) return
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('protocol_assignments')
                .select('*, protocol:protocols(*)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            setAssignments(data || [])
        } catch (err) {
            console.error('Error fetching assignments:', err)
        } finally {
            setLoading(false)
        }
    }

    const assignProtocol = async (protocolId: string, targetUserId: string) => {
        try {
            const { data, error } = await supabase
                .from('protocol_assignments')
                .insert([{ protocol_id: protocolId, user_id: targetUserId }])
                .select()
                .single()

            if (error) throw error
            setAssignments(prev => [data, ...prev])
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    useEffect(() => {
        fetchAssignments()
    }, [userId])

    return { assignments, loading, assignProtocol, refresh: fetchAssignments }
}

// ==========================================
// PROGRESS
// ==========================================

export interface ProgressItem {
    id: string
    assignment_id: string
    protocol_item_id: string
    completed_at: string
    photo_url?: string
    points_earned: number
}

export function useProgress(assignmentId?: string) {
    const [progress, setProgress] = useState<ProgressItem[]>([])
    const [loading, setLoading] = useState(true)

    const fetchProgress = async () => {
        if (!assignmentId) return
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('protocol_progress')
                .select('*')
                .eq('assignment_id', assignmentId)
                .limit(200)

            if (error) throw error
            setProgress(data || [])
        } catch (err) {
            console.error('Error fetching progress:', err)
        } finally {
            setLoading(false)
        }
    }

    const markItemCompleted = async (itemId: string, points: number = 10) => {
        if (!assignmentId) return
        try {
            const { data, error } = await supabase
                .from('protocol_progress')
                .insert([{ assignment_id: assignmentId, protocol_item_id: itemId, points_earned: points }])
                .select()
                .single()

            if (error) throw error
            setProgress(prev => [...prev, data])
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    useEffect(() => {
        fetchProgress()
    }, [assignmentId])

    return { progress, loading, markItemCompleted, refresh: fetchProgress }
}
