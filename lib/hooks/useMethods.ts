// Hook para gerenciar Métodos e Fases (etapas da jornada) — arquitetura de Método Clínico
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

export interface MethodPhase {
    id: string
    method_id: string
    tenant_id: string
    name: string
    description: string | null
    sort_order: number
    created_at: string
    updated_at: string
}

export interface Method {
    id: string
    tenant_id: string
    name: string
    description: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string | null
    method_phases: MethodPhase[]
}

export function useMethods() {
    const [methods, setMethods] = useState<Method[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchMethods = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('methods')
                .select('*, method_phases(*)')
                .order('created_at', { ascending: true })

            if (error) throw error
            const sorted = (data || []).map((m: any) => ({
                ...m,
                method_phases: (m.method_phases || []).sort((a: MethodPhase, b: MethodPhase) => a.sort_order - b.sort_order),
            }))
            setMethods(sorted)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const createMethod = async (method: { name: string; description?: string | null; tenant_id: string }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const { data, error } = await supabase
                .from('methods')
                .insert([{ ...method, created_by: user?.id ?? null }])
                .select('*, method_phases(*)')
                .single()

            if (error) throw error
            setMethods(prev => [...prev, { ...data, method_phases: data.method_phases || [] }])
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const updateMethod = async (id: string, updates: Partial<Pick<Method, 'name' | 'description' | 'is_active'>>) => {
        try {
            const { data, error } = await supabase
                .from('methods')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            setMethods(prev => prev.map(m => m.id === id ? { ...m, ...data } : m))
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const deleteMethod = async (id: string) => {
        try {
            const { error } = await supabase.from('methods').delete().eq('id', id)
            if (error) throw error
            setMethods(prev => prev.filter(m => m.id !== id))
            return { error: null }
        } catch (err: any) {
            return { error: err.message }
        }
    }

    const createPhase = async (phase: { method_id: string; tenant_id: string; name: string; description?: string | null; sort_order: number }) => {
        try {
            const { data, error } = await supabase
                .from('method_phases')
                .insert([phase])
                .select()
                .single()

            if (error) throw error
            setMethods(prev => prev.map(m => m.id === phase.method_id
                ? { ...m, method_phases: [...m.method_phases, data].sort((a, b) => a.sort_order - b.sort_order) }
                : m))
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const updatePhase = async (id: string, methodId: string, updates: Partial<Pick<MethodPhase, 'name' | 'description' | 'sort_order'>>) => {
        try {
            const { data, error } = await supabase
                .from('method_phases')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            setMethods(prev => prev.map(m => m.id === methodId
                ? { ...m, method_phases: m.method_phases.map(p => p.id === id ? data : p).sort((a, b) => a.sort_order - b.sort_order) }
                : m))
            return { data, error: null }
        } catch (err: any) {
            return { data: null, error: err.message }
        }
    }

    const deletePhase = async (id: string, methodId: string) => {
        try {
            const { error } = await supabase.from('method_phases').delete().eq('id', id)
            if (error) throw error
            setMethods(prev => prev.map(m => m.id === methodId
                ? { ...m, method_phases: m.method_phases.filter(p => p.id !== id) }
                : m))
            return { error: null }
        } catch (err: any) {
            return { error: err.message }
        }
    }

    useEffect(() => {
        fetchMethods()
    }, [])

    return {
        methods,
        loading,
        error,
        fetchMethods,
        createMethod,
        updateMethod,
        deleteMethod,
        createPhase,
        updatePhase,
        deletePhase,
    }
}
