// Hooks para gerenciar dados do Supabase
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { BaseClinicalEntity, ClinicalCategory, duplicateAsset } from '@/lib/services/clinicalAssets'

// ==========================================
// PROTOCOLS
// ==========================================

export interface ProtocolItemRow {
    id: string
    protocol_day_id: string
    time: string | null
    type: string
    title: string
    description: string | null
    points: number
    order_index: number
}

export interface ProtocolDayRow {
    id: string
    protocol_id: string
    day_number: number
    title: string
    subtitle: string | null
    protocol_items: ProtocolItemRow[]
}

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
    protocol_days?: ProtocolDayRow[]
}

// Mapeia o item_type usado pelo formulário (UI) para o `type` gravado em
// protocol_items — as duas telas de criação de protocolo (ProtocolsView e o
// builder relacional em app/admin/protocols/new) usam vocabulários distintos.
const PROTOCOL_ITEM_TYPE_MAP: Record<string, string> = {
    meal: 'meal', shot: 'shot', water: 'water', workout: 'workout', content: 'content', custom: 'custom',
    exercise: 'workout', habit: 'custom',
}

// Grava a estrutura de dias/tarefas de um protocolo em protocol_days/protocol_items
// (fonte de verdade real — é o que o app da paciente e a página pública de
// protocolos standalone leem). Substitui integralmente os dias existentes.
async function replaceProtocolDays(protocolId: string, tenantId: string | null, days: any[]) {
    const { error: delError } = await supabase.from('protocol_days').delete().eq('protocol_id', protocolId)
    if (delError) throw delError

    for (let i = 0; i < days.length; i++) {
        const day = days[i]
        const dayNumber = day.day ?? day.day_number ?? (i + 1)
        const { data: dayRow, error: dayError } = await supabase
            .from('protocol_days')
            .insert([{
                protocol_id: protocolId,
                tenant_id: tenantId,
                day_number: dayNumber,
                title: day.title || `Dia ${dayNumber}`,
                subtitle: day.subtitle || null,
            }])
            .select()
            .single()

        if (dayError) throw dayError

        const items = (day.items || []).map((item: any, idx: number) => ({
            protocol_day_id: dayRow.id,
            tenant_id: tenantId,
            type: PROTOCOL_ITEM_TYPE_MAP[item.item_type || item.type] || 'custom',
            item_kind: 'custom',
            time: item.time || null,
            title: item.title || '',
            description: item.description || null,
            points: item.points ?? 10,
            is_mandatory: true,
            order_index: item.order_index ?? idx,
        }))

        if (items.length > 0) {
            const { error: itemsError } = await supabase.from('protocol_items').insert(items)
            if (itemsError) throw itemsError
        }
    }
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
                .select('*, protocol_days(*, protocol_items(*))')
                .order('created_at', { ascending: false })
                .order('day_number', { referencedTable: 'protocol_days', ascending: true })
                .order('order_index', { referencedTable: 'protocol_days.protocol_items', ascending: true })
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

    const createProtocol = async (protocol: Omit<Protocol, 'id' | 'created_at'> & { days?: any[] }) => {
        try {
            const { days, ...protocolFields } = protocol as any
            const { data, error } = await supabase
                .from('protocols')
                .insert([protocolFields])
                .select()
                .single()

            if (error) throw error

            if (days && days.length > 0) {
                await replaceProtocolDays(data.id, protocolFields.tenant_id ?? null, days)
            }

            // Refetch para trazer protocol_days/protocol_items recém-gravados
            await fetchProtocols()
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const updateProtocol = async (id: string, updates: Partial<Protocol> & { days?: any[] }) => {
        try {
            const { days, ...updateFields } = updates as any
            const { data, error } = await supabase
                .from('protocols')
                .update(updateFields)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            if (days) {
                await replaceProtocolDays(id, data.tenant_id ?? null, days)
            }

            await fetchProtocols()
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
    // Contrato de Ativo Clínico (ADR-0002) — Metas viram um ativo de pleno
    // direito, gerenciado pela Biblioteca Clínica (ADR-0001).
    tags: string[]
    image_url: string | null
    sort_order: number
    is_ai_generated: boolean
    ai_summary: string | null
    ai_keywords: string[]
    indications: string | null
    contraindications: string | null
    embedding_status: string | null
    last_ai_update: string | null
    created_by: string | null
    created_at: string
    updated_at: string
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

    const updateGoal = async (id: string, updates: Partial<Goal>) => {
        try {
            const { data, error } = await supabase
                .from('goals')
                .update(updates)
                .eq('id', id)
                .select()
                .single()
            if (error) throw error
            setGoals(prev => prev.map(g => g.id === id ? data : g))
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const toggleGoalActive = async (id: string) => {
        const goal = goals.find(g => g.id === id)
        if (!goal) return
        return updateGoal(id, { is_active: !goal.is_active })
    }

    const duplicateGoal = async (id: string) => {
        const result = await duplicateAsset<Goal>(supabase, 'goals', id)
        if (result.data) setGoals(prev => [result.data as Goal, ...prev])
        return result
    }

    useEffect(() => { fetchGoals() }, [tenantId])

    return { goals, loading, createGoal, deleteGoal, toggleGoalFavorite, updateGoal, toggleGoalActive, duplicateGoal, refresh: fetchGoals }
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
    ranking_rewards: { position: number; label: string; image_url?: string | null }[] | null
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
                .select('*, protocol:protocols(*, protocol_days(*, protocol_items(*)))')
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

// ==========================================
// ATIVOS CLÍNICOS (Biblioteca Clínica — ADR-0001/0002/0003)
// Um hook genérico reaproveitado por todas as entidades, em vez de
// reescrever a mesma lógica de CRUD 6 vezes.
// ==========================================

export interface Recipe extends BaseClinicalEntity {
    category_id: string | null
    emoji: string
    meal_type: string[]
    dietary_tags: string[]
    prep_time_min: number | null
    servings: number
    instructions: string
    calories: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
    substitutions: any
    access_tier: 'basic' | 'premium'
}

export interface Meal extends BaseClinicalEntity {
    category_id: string | null
    notes: string | null
}

export interface Shot extends BaseClinicalEntity {
    category_id: string | null
    instructions: string | null
    volume_ml: number | null
    best_time: string | null
}

export interface Tea extends BaseClinicalEntity {
    category_id: string | null
    instructions: string | null
    best_time: string | null
}

export interface Supplement extends BaseClinicalEntity {
    category_id: string | null
    default_dosage: number | null
    dosage_unit: string | null
    frequency: string | null
    best_time: string | null
}

export interface Material extends BaseClinicalEntity {
    category_id: string | null
    file_url: string | null
    external_url: string | null
    estimated_minutes: number | null
    author: string | null
    source: string | null
}

// Composição relacional (ADR-0003) — nunca JSON quando existe alternativa
// relacional. Usada por meals/shots/teas/recipes.
export interface ComponentRow {
    id: string
    tenant_id: string
    quantity: number | null
    unit: string | null
    serving_label: string | null
    sort_order: number
    food_id: string | null
    recipe_id: string | null
    supplement_id: string | null
    created_at: string
}

function useClinicalAssets<T extends BaseClinicalEntity>(table: string) {
    const [items, setItems] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchItems = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .order('sort_order', { ascending: true })

            if (error) throw error
            setItems(data || [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const createItem = async (item: Partial<T>) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const { data, error } = await supabase
                .from(table)
                .insert([{ ...item, created_by: user?.id ?? null }])
                .select()
                .single()

            if (error) throw error
            setItems(prev => [...prev, data])
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const updateItem = async (id: string, updates: Partial<T>) => {
        try {
            const { data, error } = await supabase
                .from(table)
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            setItems(prev => prev.map(i => i.id === id ? data : i))
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    // "Arquivar" usa o mesmo mecanismo do toggle ativo/inativo (ADR-0002 —
    // is_active boolean, sem terceiro estado).
    const toggleActive = async (id: string) => {
        const item = items.find(i => i.id === id)
        if (!item) return { data: null, error: 'Item não encontrado' }
        return updateItem(id, { is_active: !item.is_active } as Partial<T>)
    }

    const duplicateItem = async (id: string) => {
        const result = await duplicateAsset<T>(supabase, table, id)
        if (result.data) setItems(prev => [...prev, result.data as T])
        return result
    }

    useEffect(() => { fetchItems() }, [])

    return { items, loading, error, fetchItems, createItem, updateItem, toggleActive, duplicateItem }
}

export function useRecipes() { return useClinicalAssets<Recipe>('recipes') }
export function useMeals() { return useClinicalAssets<Meal>('meals') }
export function useShots() { return useClinicalAssets<Shot>('shots') }
export function useTeas() { return useClinicalAssets<Tea>('teas') }
export function useSupplements() { return useClinicalAssets<Supplement>('supplements') }
export function useMaterials() { return useClinicalAssets<Material>('materials') }

// Composição relacional de meals/shots/teas/recipes — mesmo padrão para as 4.
function useAssetComponents(table: string, parentColumn: string, parentId?: string) {
    const [components, setComponents] = useState<ComponentRow[]>([])
    const [loading, setLoading] = useState(true)

    const fetchComponents = async () => {
        if (!parentId) { setComponents([]); setLoading(false); return }
        setLoading(true)
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq(parentColumn, parentId)
            .order('sort_order', { ascending: true })
        if (!error) setComponents(data || [])
        setLoading(false)
    }

    const addComponent = async (component: Partial<ComponentRow> & { tenant_id: string }) => {
        if (!parentId) return { data: null, error: 'Ativo pai não definido' }
        try {
            const { data, error } = await supabase
                .from(table)
                .insert([{ ...component, [parentColumn]: parentId, sort_order: components.length }])
                .select()
                .single()
            if (error) throw error
            setComponents(prev => [...prev, data])
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const removeComponent = async (id: string) => {
        try {
            const { error } = await supabase.from(table).delete().eq('id', id)
            if (error) throw error
            setComponents(prev => prev.filter(c => c.id !== id))
            return { error: null }
        } catch (err: any) {
            return { error: err.message }
        }
    }

    useEffect(() => { fetchComponents() }, [parentId])

    return { components, loading, addComponent, removeComponent, refresh: fetchComponents }
}

export function useMealComponents(mealId?: string) { return useAssetComponents('meal_components', 'meal_id', mealId) }
export function useShotComponents(shotId?: string) { return useAssetComponents('shot_components', 'shot_id', shotId) }
export function useTeaComponents(teaId?: string) { return useAssetComponents('tea_components', 'tea_id', teaId) }
export function useRecipeComponents(recipeId?: string) { return useAssetComponents('recipe_components', 'recipe_id', recipeId) }

// ==========================================
// CATEGORIAS CLÍNICAS (clinical_categories)
// ==========================================

export function useClinicalCategories(entityType: ClinicalCategory['entity_type']) {
    const [categories, setCategories] = useState<ClinicalCategory[]>([])
    const [loading, setLoading] = useState(true)

    const fetchCategories = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('clinical_categories')
            .select('*')
            .eq('entity_type', entityType)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
        if (!error) setCategories(data || [])
        setLoading(false)
    }

    const createCategory = async (name: string, tenantId: string) => {
        try {
            const { data, error } = await supabase
                .from('clinical_categories')
                .insert([{ tenant_id: tenantId, entity_type: entityType, name, sort_order: categories.length }])
                .select()
                .single()
            if (error) throw error
            setCategories(prev => [...prev, data])
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    useEffect(() => { fetchCategories() }, [entityType])

    return { categories, loading, createCategory, refresh: fetchCategories }
}
