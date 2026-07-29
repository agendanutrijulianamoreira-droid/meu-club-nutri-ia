'use client';

import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Coins, TrendingUp, Zap } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

interface GamificationHeaderProps {
    userId: string;
    initialCoins?: number;
    initialXP?: number;
    initialLevel?: number;
    streak?: number;
}

/**
 * GamificationHeader - Header com NutriCoins animados
 * 
 * Features:
 * - Animação de contagem suave ao ganhar moedas
 * - Neon Green para indicar ganhos (Sistema de Não-Punição)
 * - Efeito de brilho ao receber recompensas
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
            <div className="flex items-center justify-between">

                {/* NutriCoins */}
                <div className="flex items-center gap-3 relative">
                    <motion.div
                        className="relative"
                        animate={showGainAnimation ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="relative">
                            <Coins className="w-10 h-10 text-amber-400" />

                            {/* Brilho de ganho */}
                            {showGainAnimation && (
                                <motion.div
                                    className="absolute inset-0 rounded-full bg-green-400/30 blur-xl"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 2, opacity: [0, 1, 0] }}
                                    transition={{ duration: 1 }}
                                />
                            )}
                        </div>
                    </motion.div>

                    <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide">
                            NutriCoins
                        </div>
                        <motion.div className="text-3xl font-bold text-white flex items-baseline gap-2">
                            <motion.span>
                                {displayCoins as any}
                            </motion.span>

                            {/* Indicador de ganho (Neon Green) */}
                            {showGainAnimation && (
                                <motion.span
                                    className="text-lg text-green-400 flex items-center gap-1"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    +{lastGain}
                                </motion.span>
                            )}
                        </motion.div>
                    </div>
                </div>

                {/* Stats Secundários */}
                <div className="flex gap-6">

                    {/* XP e Level */}
                    <div className="text-right">
                        <div className="text-xs text-gray-400 uppercase tracking-wide">
                            Level
                        </div>
                        <div className="text-2xl font-bold text-violet-400">
                            {initialLevel}
                        </div>
                        <div className="text-xs text-gray-500">
                            {initialXP} XP
                        </div>
                    </div>

                    {/* Streak */}
                    {streak > 0 && (
                        <div className="text-right">
                            <div className="text-xs text-gray-400 uppercase tracking-wide">
                                Streak
                            </div>
                            <div className="text-2xl font-bold text-orange-400 flex items-center justify-end gap-1">
                                <Zap className="w-5 h-5 fill-orange-400" />
                                {streak}
                            </div>
                            <div className="text-xs text-gray-500">
                                dias
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Barra de Progresso para próximo nível */}
            <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Nível {initialLevel}</span>
                    <span>Nível {initialLevel + 1}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-pink-500 to-violet-500"
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
