import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

export type UsagePatternScope = 'protocol_item' | 'method_phase'

export interface UsagePattern {
    id: string
    tenant_id: string
    scope: UsagePatternScope
    dedupe_key: string
    value: Record<string, any>
    usage_count: number
    last_used_at: string
}

function normalizeKey(raw: string) {
    return raw.trim().toLowerCase()
}

/**
 * Sugestões de atalho: carrega os padrões mais usados de um escopo
 * (tarefas de protocolo ou fases de método) pra sugerir preenchimento
 * automático, e grava/incrementa o contador toda vez que um valor é usado.
 * Espelha o mesmo padrão síncrono de useContentTemplates.ts (usage_count).
 */
export function useUsagePatterns(scope: UsagePatternScope, limit = 6) {
    const [suggestions, setSuggestions] = useState<UsagePattern[]>([])
    const [loading, setLoading] = useState(true)

    const load = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('usage_patterns')
                .select('*')
                .eq('scope', scope)
                .order('usage_count', { ascending: false })
                .limit(limit)

            if (error) throw error
            setSuggestions(data || [])
        } catch (err) {
            console.error('Error loading usage patterns:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [scope, limit])

    // Grava/incrementa o uso de um valor (ex: título de tarefa, nome de fase).
    // dedupeSource é o campo que identifica "o mesmo" padrão (título ou nome).
    const recordUsage = async (dedupeSource: string, value: Record<string, any>) => {
        const key = normalizeKey(dedupeSource)
        if (!key) return

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('user_id', session.user.id)
                .maybeSingle()

            if (!profile?.tenant_id) return

            // Incremento atômico no banco (record_usage_pattern) — não lê a
            // contagem atual do estado local, que só tem os top-N padrões.
            await supabase.rpc('record_usage_pattern', {
                p_tenant_id: profile.tenant_id,
                p_scope: scope,
                p_dedupe_key: key,
                p_value: value,
            })
        } catch (err) {
            // Atalho é conveniência, não deve travar o fluxo principal de salvar
            console.error('Error recording usage pattern:', err)
        }
    }

    return { suggestions, loading, recordUsage, refresh: load }
}
