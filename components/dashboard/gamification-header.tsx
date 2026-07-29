'use client';

import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Coins, Zap } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

interface GamificationHeaderProps {
    userId: string;
    initialCoins?: number;
    initialXP?: number;
    initialLevel?: number;
    streak?: number;
}

/**
 * Sua Jornada no Reino - Resumo de moedas, nível e streak
 *
 * Destaques em Ouro (#C9A435), sem neon e sem gradientes vibrantes.
 */
export function GamificationHeader({
    userId,
    initialCoins = 0,
    initialXP = 0,
    initialLevel = 1,
    streak = 0
}: GamificationHeaderProps) {

    const [coins, setCoins] = useState(initialCoins);
    const [showGainAnimation, setShowGainAnimation] = useState(false);
    const [lastGain, setLastGain] = useState(0);

    // Animação suave de contagem
    const springCoins = useSpring(coins, {
        stiffness: 100,
        damping: 30,
        mass: 0.5
    });

    const displayCoins = useTransform(springCoins, (latest) => Math.floor(latest));

    // Simular ganho de moedas (em produção, virá do Supabase Realtime)
    useEffect(() => {
        // Listener para novos check-ins
        const handleCoinsUpdate = (event: CustomEvent) => {
            const newCoins = event.detail.coins;
            const gain = newCoins - coins;

            if (gain > 0) {
                setLastGain(gain);
                setShowGainAnimation(true);
                setCoins(newCoins);

                setTimeout(() => setShowGainAnimation(false), 2000);
            }
        };

        window.addEventListener('coins_updated' as any, handleCoinsUpdate);
        return () => window.removeEventListener('coins_updated' as any, handleCoinsUpdate);
    }, [coins]);

    return (
        <GlassCard className="p-6 mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C9A435] mb-4">
                Sua Jornada no Reino
            </p>

            <div className="flex items-center justify-between">

                {/* NutriCoins */}
                <div className="flex items-center gap-3 relative">
                    <motion.div
                        animate={showGainAnimation ? { scale: [1, 1.15, 1] } : {}}
                        transition={{ duration: 0.5 }}
                    >
                        <Coins className="w-9 h-9 text-[#C9A435]" />
                    </motion.div>

                    <div>
                        <div className="text-xs text-[#2B1A10]/50 uppercase tracking-wide">
                            NutriCoins
                        </div>
                        <div className="text-3xl font-bold text-[#2B1A10] flex items-baseline gap-2">
                            <motion.span>
                                {displayCoins as any}
                            </motion.span>

                            {showGainAnimation && (
                                <motion.span
                                    className="text-sm font-semibold text-[#C9A435]"
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    +{lastGain}
                                </motion.span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Secundários */}
                <div className="flex gap-6">

                    {/* XP e Level */}
                    <div className="text-right">
                        <div className="text-xs text-[#2B1A10]/50 uppercase tracking-wide">
                            Nível
                        </div>
                        <div className="text-2xl font-bold text-[#2B1A10]">
                            {initialLevel}
                        </div>
                        <div className="text-xs text-[#2B1A10]/40">
                            {initialXP} XP
                        </div>
                    </div>

                    {/* Streak */}
                    {streak > 0 && (
                        <div className="text-right">
                            <div className="text-xs text-[#2B1A10]/50 uppercase tracking-wide">
                                Sequência
                            </div>
                            <div className="text-2xl font-bold text-[#2B1A10] flex items-center justify-end gap-1">
                                <Zap className="w-5 h-5 text-[#C9A435] fill-[#C9A435]" />
                                {streak}
                            </div>
                            <div className="text-xs text-[#2B1A10]/40">
                                dias
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Barra de Progresso para próximo nível */}
            <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-[#2B1A10]/40 mb-1">
                    <span>Nível {initialLevel}</span>
                    <span>Nível {initialLevel + 1}</span>
                </div>
                <div className="h-1.5 bg-[#2B1A10]/[0.06] rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-[#C9A435]"
                        initial={{ width: 0 }}
                        animate={{ width: `${(initialXP % 500) / 5}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                    />
                </div>
            </div>
        </GlassCard>
    );
}

// Hook customizado para atualizar moedas (usar em check-ins)
export function useUpdateCoins() {
    const updateCoins = (newTotal: number) => {
        const event = new CustomEvent('coins_updated', {
            detail: { coins: newTotal }
        });
        window.dispatchEvent(event);
    };

    return { updateCoins };
}
