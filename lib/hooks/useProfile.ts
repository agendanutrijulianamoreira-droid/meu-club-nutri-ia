'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface Profile {
    id: string;
    user_id: string;
    tenant_id: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
    current_plan: 'community' | 'tech_diet' | 'vip';
    nutri_coins: number;
    total_xp: number;
    current_level: number;
    current_streak: number;
    longest_streak: number;
    primary_goal: string | null;
    dietary_restrictions: string[];
}

/**
 * Hook para buscar e gerenciar perfil do usuário
 * Inclui dados de gamificação (moedas, XP, level, streak)
 */
export function useProfile(userId: string | null) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();

    // Buscar perfil
    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            try {
                setLoading(true);

                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (error) throw error;

                setProfile(data);
            } catch (err: any) {
                setError(err.message);
                console.error('Erro ao buscar perfil:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();

        // Realtime subscription para atualizar moedas automaticamente
        const channel = supabase
            .channel('profile-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    setProfile(payload.new as Profile);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    /**
     * Atualizar perfil
     */
    const updateProfile = async (updates: Partial<Profile>) => {
        if (!userId) return { success: false, error: 'User ID não fornecido' };

        try {
            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) throw error;

            setProfile(data);
            return { success: true, data };
        } catch (err: any) {
            console.error('Erro ao atualizar perfil:', err);
            return { success: false, error: err.message };
        }
    };

    return {
        profile,
        loading,
        error,
        updateProfile,
        // Shortcuts
        coins: profile?.nutri_coins || 0,
        xp: profile?.total_xp || 0,
        level: profile?.current_level || 1,
        streak: profile?.current_streak || 0,
        plan: profile?.current_plan || 'community',
    };
}
