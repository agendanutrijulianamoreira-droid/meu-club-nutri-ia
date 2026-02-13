'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

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

    const supabase = createClient();

    // Buscar log de hoje
    useEffect(() => {
        if (!userId) return;

        const fetchTodayLog = async () => {
            try {
                setLoading(true);
                const today = new Date().toISOString().split('T')[0];

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
     * Salvar ou atualizar check-in do dia
     */
    const saveCheckIn = async (checks: {
        water_check?: boolean;
        workout_check?: boolean;
        sleep_check?: boolean;
        meal_plan_check?: boolean;
        daily_victory?: string;
        proof_photo_url?: string;
    }) => {
        try {
            const today = new Date().toISOString().split('T')[0];

            if (todayLog) {
                // Atualizar log existente
                const { data, error } = await supabase
                    .from('daily_logs')
                    .update(checks)
                    .eq('id', todayLog.id)
                    .select()
                    .single();

                if (error) throw error;

                setTodayLog(data);
                return { success: true, data };
            } else {
                // Criar novo log
                const { data, error } = await supabase
                    .from('daily_logs')
                    .insert({
                        user_id: userId,
                        log_date: today,
                        ...checks,
                    })
                    .select()
                    .single();

                if (error) throw error;

                setTodayLog(data);
                return { success: true, data };
            }
        } catch (err: any) {
            console.error('Erro ao salvar check-in:', err);
            return { success: false, error: err.message };
        }
    };

    /**
     * Marcar check-in individual
     */
    const toggleCheck = async (checkType: 'water' | 'workout' | 'sleep' | 'meal') => {
        const checkField = `${checkType}_check` as keyof typeof checks;
        const currentValue = todayLog?.[checkField] || false;

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
