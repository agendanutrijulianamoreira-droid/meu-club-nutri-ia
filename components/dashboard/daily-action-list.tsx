'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Droplet, Dumbbell, Moon, UtensilsCrossed } from 'lucide-react';
import confetti from 'canvas-confetti';
import { GlassCardCompact } from '../ui/glass-card';

interface DailyAction {
    id: string;
    type: 'water' | 'workout' | 'sleep' | 'meal';
    label: string;
    points: number;
    completed: boolean;
}

interface DailyActionListProps {
    userId: string;
    date?: Date;
    onComplete?: (actionId: string, points: number) => void;
}

const ACTION_ICONS = {
    water: Droplet,
    workout: Dumbbell,
    sleep: Moon,
    meal: UtensilsCrossed,
};

const ACTION_COLORS = {
    water: 'text-blue-400',
    workout: 'text-orange-400',
    sleep: 'text-purple-400',
    meal: 'text-green-400',
};

/**
 * DailyActionList - Checklist gamificado com confetes
 * 
 * Features:
 * - Checkboxes estilizados com animações
 * - Confete ao marcar (Efeito Vencedor)
 * - Sistema de Não-Punição: apenas reforço positivo
 * - Integração com Supabase daily_logs
 */
export function DailyActionList({
    userId,
    date = new Date(),
    onComplete
}: DailyActionListProps) {

    const [actions, setActions] = useState<DailyAction[]>([
        { id: 'water', type: 'water', label: 'Beber 2L de água', points: 10, completed: false },
        { id: 'workout', type: 'workout', label: 'Fazer treino do dia', points: 20, completed: false },
        { id: 'sleep', type: 'sleep', label: 'Dormir 7-9 horas', points: 10, completed: false },
        { id: 'meal', type: 'meal', label: 'Seguir cardápio', points: 30, completed: false },
    ]);

    /**
     * Dispara confete com cores customizadas
     */
    const triggerConfetti = () => {
        const colors = ['#EC4899', '#8B5CF6', '#F59E0B', '#10B981'];

        confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: colors,
            disableForReducedMotion: true,
            scalar: 0.8,
        });
    };

    /**
     * Marcar/desmarcar ação
     */
    const toggleAction = async (actionId: string) => {
        const action = actions.find(a => a.id === actionId);
        if (!action) return;

        const newCompleted = !action.completed;

        // Atualizar estado local
        setActions(prev =>
            prev.map(a =>
                a.id === actionId
                    ? { ...a, completed: newCompleted }
                    : a
            )
        );

        // Se completou (não desmarcou), disparar confete
        if (newCompleted) {
            triggerConfetti();

            // Callback para atualizar moedas
            if (onComplete) {
                onComplete(actionId, action.points);
            }

            // TODO: Salvar no Supabase
            // await updateDailyLog(userId, date, { [action.type + '_check']: true });
        }
    };

    const completedCount = actions.filter(a => a.completed).length;
    const totalPoints = actions.reduce((sum, a) => sum + (a.completed ? a.points : 0), 0);
    const progressPercent = (completedCount / actions.length) * 100;

    return (
        <GlassCardCompact className="space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">
                        Ações do Dia
                    </h3>
                    <p className="text-sm text-gray-400">
                        {completedCount} de {actions.length} completas
                    </p>
                </div>

                {/* Pontos acumulados */}
                <motion.div
                    className="text-right"
                    key={totalPoints}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="text-2xl font-bold text-green-400">
                        +{totalPoints}
                    </div>
                    <div className="text-xs text-gray-400">pontos</div>
                </motion.div>
            </div>

            {/* Barra de Progresso */}
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    className="h-full bg-gradient-to-r from-pink-500 to-violet-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </div>

            {/* Lista de Ações */}
            <div className="space-y-2">
                {actions.map((action, index) => {
                    const Icon = ACTION_ICONS[action.type];
                    const colorClass = ACTION_COLORS[action.type];

                    return (
                        <motion.button
                            key={action.id}
                            onClick={() => toggleAction(action.id)}
                            className={`
                w-full flex items-center gap-3 p-3 rounded-xl
                transition-all duration-200
                ${action.completed
                                    ? 'bg-white/10 border border-green-400/30'
                                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                }
              `}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >

                            {/* Checkbox customizado */}
                            <div className={`
                relative w-6 h-6 rounded-lg border-2 flex-shrink-0
                ${action.completed
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-white/30'
                                }
              `}>
                                <AnimatePresence>
                                    {action.completed && (
                                        <motion.div
                                            initial={{ scale: 0, rotate: -180 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            exit={{ scale: 0, rotate: 180 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                        >
                                            <Check className="w-5 h-5 text-white absolute inset-0.5" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Ícone da ação */}
                            <Icon className={`w-5 h-5 ${colorClass} flex-shrink-0`} />

                            {/* Label */}
                            <span className={`
                flex-1 text-left text-sm font-medium
                ${action.completed ? 'text-white line-through' : 'text-gray-300'}
              `}>
                                {action.label}
                            </span>

                            {/* Pontos */}
                            <span className={`
                text-xs font-semibold px-2 py-1 rounded-full
                ${action.completed
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-white/5 text-gray-400'
                                }
              `}>
                                +{action.points}
                            </span>
                        </motion.button>
                    );
                })}
            </div>

            {/* Mensagem de encorajamento */}
            {completedCount === actions.length && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20"
                >
                    <p className="text-green-400 font-semibold">
                        🎉 Dia completo, Rainha!
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        Você é imparável! Continue assim.
                    </p>
                </motion.div>
            )}
        </GlassCardCompact>
    );
}
