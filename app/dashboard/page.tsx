'use client';

import { useEffect, useState } from 'react';
import { GamificationHeader } from '@/components/dashboard/gamification-header';
import { DailyActionList } from '@/components/dashboard/daily-action-list';
import { PanicButton } from '@/components/dashboard/panic-button';
import { GlassCard } from '@/components/ui/glass-card';
import { useProfile } from '@/lib/hooks/useProfile';
import { useDailyLogs } from '@/lib/hooks/useDailyLogs';
import { supabase } from '@/lib/supabase-browser'

/**
 * Dashboard do Paciente - Integração Completa
 * 
 * Conecta todos os componentes com dados reais do Supabase:
 * - GamificationHeader mostra moedas/XP/streak em tempo real
 * - DailyActionList salva check-ins no banco
 * - PanicButton aparece apenas para VIPs
 */
export default function DashboardPage() {
    // supabase importado do singleton
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Buscar usuário autenticado
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
            setLoading(false);
        };

        getUser();
    }, []);

    // Hooks de dados
    const { profile, coins, xp, level, streak, plan } = useProfile(userId);
    const { todayLog, toggleCheck } = useDailyLogs(userId || '');

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1744] to-[#0f0c29] flex items-center justify-center">
                <div className="text-white text-xl">Carregando...</div>
            </div>
        );
    }

    if (!userId) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1744] to-[#0f0c29] flex items-center justify-center">
                <GlassCard className="p-8 max-w-md">
                    <h2 className="text-white text-2xl font-bold mb-4">Bem-vinda! 👋</h2>
                    <p className="text-gray-300 mb-6">
                        Faça login para acessar seu dashboard personalizado.
                    </p>
                    <button
                        onClick={() => window.location.href = '/login'}
                        className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 text-white font-semibold hover:shadow-lg transition-all"
                    >
                        Ir para Login
                    </button>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1744] to-[#0f0c29]">

            {/* Container Principal */}
            <div className="max-w-4xl mx-auto px-4 py-8">

                {/* Header de Gamificação */}
                <GamificationHeader
                    userId={userId}
                    initialCoins={coins}
                    initialXP={xp}
                    initialLevel={level}
                    streak={streak}
                />

                {/* Saudação */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Olá, {profile?.name || 'Rainha'}! 👑
                    </h1>
                    <p className="text-gray-400">
                        {new Date().toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </p>
                </div>

                {/* Grid de Conteúdo */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">

                    {/* Daily Actions */}
                    <div>
                        <DailyActionList
                            userId={userId}
                            date={new Date()}
                            onComplete={async (actionId, points) => {
                                // Mapear actionId para tipo de check
                                const checkTypeMap: Record<string, 'water' | 'workout' | 'sleep' | 'meal'> = {
                                    'water': 'water',
                                    'workout': 'workout',
                                    'sleep': 'sleep',
                                    'meal': 'meal',
                                };

                                const checkType = checkTypeMap[actionId];
                                if (checkType) {
                                    await toggleCheck(checkType);
                                }
                            }}
                        />
                    </div>

                    {/* Card de Objetivo */}
                    <GlassCard className="p-6">
                        <h3 className="text-xl font-bold text-white mb-4">
                            Seu Objetivo 🎯
                        </h3>
                        <p className="text-gray-300 text-sm mb-4">
                            {profile?.primary_goal || 'Definir objetivo principal'}
                        </p>

                        {/* Stats Rápidos */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 rounded-lg p-3">
                                <div className="text-xs text-gray-400 mb-1">Plano Atual</div>
                                <div className="text-white font-semibold capitalize">
                                    {plan === 'community' ? 'Community' : plan === 'tech_diet' ? 'Tech Diet' : 'VIP'}
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3">
                                <div className="text-xs text-gray-400 mb-1">Check-ins</div>
                                <div className="text-white font-semibold">
                                    {todayLog ?
                                        [todayLog.water_check, todayLog.workout_check, todayLog.sleep_check, todayLog.meal_plan_check]
                                            .filter(Boolean).length
                                        : 0
                                    }/4
                                </div>
                            </div>
                        </div>

                        {/* Botão Atualizar Objetivo */}
                        <button className="w-full mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
                            Atualizar Objetivo
                        </button>
                    </GlassCard>
                </div>

                {/* Info sobre Plano */}
                {plan === 'community' && (
                    <GlassCard className="p-6 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20">
                        <h3 className="text-lg font-bold text-violet-300 mb-2">
                            ✨ Upgrade para Tech Diet ou VIP
                        </h3>
                        <p className="text-gray-300 text-sm mb-4">
                            Desbloqueie cardápios personalizados com IA, chat ilimitado e muito mais!
                        </p>
                        <button className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold hover:shadow-lg transition-all">
                            Ver Planos
                        </button>
                    </GlassCard>
                )}
            </div>

            {/* Botão SOS (apenas VIP) */}
            <PanicButton
                userId={userId}
                userPlan={plan}
                onSend={(message) => {
                    console.log('SOS enviado:', message);
                    // TODO: Implementar envio para nutricionista
                }}
            />
        </div>
    );
}
