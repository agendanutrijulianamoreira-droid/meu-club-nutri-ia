'use client';

import { useEffect, useState } from 'react';
import { GamificationHeader } from '@/components/dashboard/gamification-header';
import { DailyActionList } from '@/components/dashboard/daily-action-list';
import { PanicButton } from '@/components/dashboard/panic-button';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-[#2B1A10]/60 text-xl font-serif">Carregando...</div>
            </div>
        );
    }

    if (!userId) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <GlassCard className="p-8 max-w-md">
                    <h2 className="text-2xl font-serif text-[#2B1A10] mb-4">Bem-vinda! 👋</h2>
                    <p className="text-[#2B1A10]/60 mb-6">
                        Faça login para acessar seu espaço personalizado.
                    </p>
                    <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => window.location.href = '/login'}
                    >
                        Ir para Login
                    </Button>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">

            {/* Container Principal */}
            <div className="max-w-5xl mx-auto px-6 py-10 md:py-16">

                {/* Saudação */}
                <div className="mb-10">
                    <h1 className="text-4xl font-serif text-[#2B1A10] mb-2">
                        Olá, {profile?.name || 'Rainha'} 👑
                    </h1>
                    <p className="text-[#2B1A10]/50">
                        {new Date().toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </p>
                </div>

                {/* Header de Gamificação */}
                <div className="mb-10">
                    <GamificationHeader
                        userId={userId}
                        initialCoins={coins}
                        initialXP={xp}
                        initialLevel={level}
                        streak={streak}
                    />
                </div>

                {/* Grid de Conteúdo */}
                <div className="grid md:grid-cols-2 gap-8 mb-10">

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
                        <h3 className="text-xl font-serif text-[#2B1A10] mb-4">
                            Seu Objetivo
                        </h3>
                        <p className="text-[#2B1A10]/60 text-sm mb-5">
                            {profile?.primary_goal || 'Definir objetivo principal'}
                        </p>

                        {/* Stats Rápidos */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#2B1A10]/[0.03] rounded-lg p-3">
                                <div className="text-xs text-[#2B1A10]/50 mb-1">Plano Atual</div>
                                <div className="text-[#2B1A10] font-semibold capitalize">
                                    {plan === 'community' ? 'Community' : plan === 'tech_diet' ? 'Tech Diet' : 'VIP'}
                                </div>
                            </div>
                            <div className="bg-[#2B1A10]/[0.03] rounded-lg p-3">
                                <div className="text-xs text-[#2B1A10]/50 mb-1">Check-ins</div>
                                <div className="text-[#2B1A10] font-semibold">
                                    {todayLog ?
                                        [todayLog.water_check, todayLog.workout_check, todayLog.sleep_check, todayLog.meal_plan_check]
                                            .filter(Boolean).length
                                        : 0
                                    }/4
                                </div>
                            </div>
                        </div>

                        {/* Botão Atualizar Objetivo */}
                        <Button variant="secondary" className="w-full mt-5">
                            Atualizar Objetivo
                        </Button>
                    </GlassCard>
                </div>

                {/* Info sobre Plano */}
                {plan === 'community' && (
                    <GlassCard className="p-6 bg-[#C9A435]/10 border-[#C9A435]/25">
                        <h3 className="text-lg font-serif text-[#2B1A10] mb-2">
                            Upgrade para Tech Diet ou VIP
                        </h3>
                        <p className="text-[#2B1A10]/60 text-sm mb-4">
                            Desbloqueie cardápios personalizados com IA, chat ilimitado e muito mais!
                        </p>
                        <Button variant="primary">
                            Ver Planos
                        </Button>
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
