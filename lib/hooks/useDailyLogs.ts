'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser';

interface DailyLog {
    id: string;
    log_date: string;
    water_check: boolean;
    workout_check: boolean;
    sleep_check: boolean;
    meal_plan_check: boolean;
    daily_victory: string | null;
    proof_photo_url: string | null;
    coins_earned: number;
    xp_earned: number;
}

/**
 * Hook para gerenciar daily logs do usuário
 * Conecta com a tabela daily_logs do Supabase
 */
export function useDailyLogs(userId: string) {
    const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Removido const supabase = createClient() pois agora usamos o singleton importado

    // Buscar log de hoje
    useEffect(() => {
        if (!userId) return;

        const fetchTodayLog = async () => {
            try {
                setLoading(true);
                // Data local (Brasil) formatada como YYYY-MM-DD
                const today = new Intl.DateTimeFormat('fr-CA', {
                    timeZone: 'America/Sao_Paulo',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(new Date());

                const { data, error } = await supabase
                    .from('daily_logs')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('log_date', today)
                    .maybeSingle();

                if (error && error.code !== 'PGRST116') {
                    throw error;
                }

                setTodayLog(data);
            } catch (err: any) {
                setError(err.message);
                console.error('Erro ao buscar daily log:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTodayLog();
    }, [userId]);

    /**
     * Salvar ou atualizar check-in do dia usando UPSERT
     */
    const saveCheckIn = async (checks: Partial<DailyLog>) => {
        try {
            // Data local (Brasil) formatada como YYYY-MM-DD
            const today = new Intl.DateTimeFormat('fr-CA', {
                timeZone: 'America/Sao_Paulo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date());

            const { data, error } = await supabase
                .from('daily_logs')
                .upsert({
                    user_id: userId,
                    log_date: today,
                    ...checks,
                }, {
                    onConflict: 'user_id,log_date'
                })
                .select()
                .single();

            if (error) throw error;

            setTodayLog(data);

            // Trigger Meals Agent if meal was checked
            if (checks.meal_plan_check !== undefined || checks.proof_photo_url) {
                fetch('/api/trigger-agent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'meal_logged',
                        payload: { log_data: checks },
                    }),
                }).catch(() => {}) // fire-and-forget
            }

            return { success: true, data };
        } catch (err: any) {
            console.error('Erro ao salvar check-in:', err);
            return { success: false, error: err.message };
        }
    };

    /**
     * Marcar check-in individual
     */
    const toggleCheck = async (checkType: 'water' | 'workout' | 'sleep' | 'meal') => {
        // Mapeamento correto: meal -> meal_plan_check
        const checkField = checkType === 'meal' ? 'meal_plan_check' : (`${checkType}_check` as keyof DailyLog);
        const currentValue = todayLog ? !!todayLog[checkField as keyof DailyLog] : false;

        const checks = {
            [checkField]: !currentValue,
        };

        return await saveCheckIn(checks);
    };

    return {
        todayLog,
        loading,
        error,
        saveCheckIn,
        toggleCheck,
    };
}
