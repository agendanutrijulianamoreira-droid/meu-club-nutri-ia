'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Sparkles, Target, Heart, TrendingUp } from 'lucide-react';
import { GlassCard } from '../ui/glass-card';

interface OnboardingWizardProps {
    onComplete: (data: OnboardingData) => void;
}

interface OnboardingData {
    name: string;
    primary_goal: string;
    selected_plan?: 'community' | 'tech_diet' | 'vip';
}

const GOALS = [
    { id: 'weight_loss', label: 'Emagrecer de forma sustentável', emoji: '⚖️' },
    { id: 'bloating', label: 'Desinchar e reduzir inchaço', emoji: '💧' },
    { id: 'energy', label: 'Mais energia e disposição', emoji: '⚡' },
    { id: 'health', label: 'Melhorar saúde em geral', emoji: '❤️' },
    { id: 'muscle', label: 'Ganhar massa muscular', emoji: '💪' },
];

const PLANS = [
    {
        id: 'community',
        name: 'Community',
        price: 'Grátis',
        features: [
            'Acesso aos protocolos mensais',
            'Comunidade exclusiva',
            'Receitas e dicas semanais',
        ],
        popular: false,
    },
    {
        id: 'tech_diet',
        name: 'Tech Diet',
        price: 'R$ 97/mês',
        features: [
            'Tudo do Community +',
            'Cardápios personalizados com IA',
            'Chat com Nutri Sábia (IA) ilimitado',
            'Suporte via WhatsApp',
        ],
        popular: true,
    },
    {
        id: 'vip',
        name: 'VIP',
        price: 'R$ 297/mês',
        features: [
            'Tudo do Tech Diet +',
            'Atendimento prioritário',
            'Botão SOS Nutri direto',
            'Consulta mensal 1-on-1',
            'Ajustes de cardápio ilimitados',
        ],
        popular: false,
    },
];

/**
 * OnboardingWizard - Fluxo de 3 passos com Progressive Profiling
 * 
 * Passo 1: Nome + Objetivo (Menor atrito)
 * Passo 2: Insight Biológico (Gancho)
 * Passo 3: Paywall Suave (Good-Better-Best)
 */
export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<OnboardingData>({
        name: '',
        primary_goal: '',
    });

    const handleNext = () => {
        if (step < 3) {
            setStep(step + 1);
        }
    };

    const handleSelectPlan = (planId: 'community' | 'tech_diet' | 'vip') => {
        onComplete({
            ...formData,
            selected_plan: planId,
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1744] to-[#0f0c29] flex items-center justify-center p-4">

            {/* Progress Bar */}
            <div className="fixed top-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4">
                <div className="flex gap-2">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`
                h-1 flex-1 rounded-full transition-all duration-300
                ${s <= step ? 'bg-gradient-to-r from-pink-500 to-violet-500' : 'bg-white/10'}
              `}
                        />
                    ))}
                </div>
            </div>

            {/* Steps */}
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <Step1
                        key="step1"
                        formData={formData}
                        setFormData={setFormData}
                        onNext={handleNext}
                    />
                )}

                {step === 2 && (
                    <Step2
                        key="step2"
                        formData={formData}
                        onNext={handleNext}
                    />
                )}

                {step === 3 && (
                    <Step3
                        key="step3"
                        onSelectPlan={handleSelectPlan}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ==========================================
// PASSO 1: Nome + Objetivo (Menor Atrito)
// ==========================================
function Step1({ formData, setFormData, onNext }: any) {
    const canProceed = formData.name.trim() && formData.primary_goal;

    return (
        <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="w-full max-w-md"
        >
            <GlassCard className="p-8">

                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring' }}
                        className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center"
                    >
                        <Heart className="w-8 h-8 text-white" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-white mb-2">
                        Bem-vinda, Rainha! 👑
                    </h2>
                    <p className="text-gray-400 text-sm">
                        Vamos começar sua jornada de transformação
                    </p>
                </div>

                {/* Nome */}
                <div className="mb-6">
                    <label className="block text-sm text-gray-300 mb-2">
                        Como podemos te chamar?
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Seu primeiro nome"
                        className="
              w-full px-4 py-3 rounded-xl
              bg-white/5 border border-white/10
              text-white placeholder-gray-500
              focus:outline-none focus:border-pink-500/50
              transition-colors
            "
                        autoFocus
                    />
                </div>

                {/* Objetivo */}
                <div className="mb-8">
                    <label className="block text-sm text-gray-300 mb-3">
                        Qual seu objetivo principal?
                    </label>
                    <div className="space-y-2">
                        {GOALS.map((goal) => (
                            <button
                                key={goal.id}
                                onClick={() => setFormData({ ...formData, primary_goal: goal.id })}
                                className={`
                  w-full p-3 rounded-xl text-left
                  flex items-center gap-3
                  transition-all duration-200
                  ${formData.primary_goal === goal.id
                                        ? 'bg-gradient-to-r from-pink-500/20 to-violet-500/20 border-2 border-pink-500'
                                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                    }
                `}
                            >
                                <span className="text-2xl">{goal.emoji}</span>
                                <span className="text-white text-sm flex-1">{goal.label}</span>
                                {formData.primary_goal === goal.id && (
                                    <ChevronRight className="w-5 h-5 text-pink-400" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Next Button */}
                <button
                    onClick={onNext}
                    disabled={!canProceed}
                    className="
            w-full px-6 py-4 rounded-xl
            bg-gradient-to-r from-pink-500 to-violet-500
            text-white font-semibold
            disabled:opacity-50 disabled:cursor-not-allowed
            hover:shadow-lg hover:shadow-pink-500/50
            transition-all
            flex items-center justify-center gap-2
          "
                >
                    Continuar
                    <ChevronRight className="w-5 h-5" />
                </button>
            </GlassCard>
        </motion.div>
    );
}

// ==========================================
// PASSO 2: Insight Biológico (Gancho)
// ==========================================
function Step2({ formData, onNext }: any) {

    // Insight fake baseado no objetivo (em produção: calcular real)
    const insights = {
        weight_loss: {
            title: 'Seu metabolismo está em modo estoque',
            description: 'Baseado em dados de 10.000+ mulheres, nas primeiras 48h você precisa ativar a queima de gordura com proteínas estratégicas e hidratação.',
            stat: '72% veem resultados na primeira semana',
        },
        bloating: {
            title: 'Detectamos padrão inflamatório',
            description: 'O inchaço é causado por retenção e inflamação intestinal. Protocolo anti-inflamatório de 7 dias reduz até 3cm de cintura.',
            stat: '85% reduzem inchaço em 5 dias',
        },
        energy: {
            title: 'Seus níveis de cortisol estão altos',
            description: 'Fadiga constante indica desregulação hormonal. Ajustes nas refeições e sono equilibram cortisol em 14 dias.',
            stat: '78% sentem mais energia em 1 semana',
        },
        health: {
            title: 'Seu corpo está em modo defesa',
            description: 'Marcadores inflamatórios elevados. Reset nutricional melhora imunidade e disposição rapidamente.',
            stat: '90% melhoram marcadores em 21 dias',
        },
        muscle: {
            title: 'Janela anabólica subutilizada',
            description: 'Para ganhar massa, você precisa de superávit calórico estratégico e proteína distribuída. Crescimento muscular em 30 dias.',
            stat: '68% ganham 1-2kg de massa magra/mês',
        },
    };

    const insight = insights[formData.primary_goal as keyof typeof insights] || insights.weight_loss;

    return (
        <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="w-full max-w-md"
        >
            <GlassCard className="p-8">

                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, type: 'spring' }}
                        className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
                    >
                        <Sparkles className="w-8 h-8 text-white" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-white mb-2">
                        {formData.name}, descobrimos algo! 🔍
                    </h2>
                    <p className="text-gray-400 text-sm">
                        Análise baseada em biologia, não achismos
                    </p>
                </div>

                {/* Insight Card */}
                <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                    <h3 className="text-lg font-semibold text-violet-300 mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        {insight.title}
                    </h3>
                    <p className="text-gray-300 text-sm mb-4">
                        {insight.description}
                    </p>

                    <div className="flex items-center gap-2 text-green-400">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-semibold">{insight.stat}</span>
                    </div>
                </div>

                <button
                    onClick={onNext}
                    className="
            w-full px-6 py-4 rounded-xl
            bg-gradient-to-r from-violet-500 to-purple-600
            text-white font-semibold
            hover:shadow-lg hover:shadow-violet-500/50
            transition-all
            flex items-center justify-center gap-2
          "
                >
                    Quero começar agora!
                    <ChevronRight className="w-5 h-5" />
                </button>
            </GlassCard>
        </motion.div>
    );
}

// ==========================================
// PASSO 3: Paywall Suave (Good-Better-Best)
// ==========================================
function Step3({ onSelectPlan }: any) {

    return (
        <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="w-full max-w-4xl"
        >
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">
                    Escolha seu plano 🚀
                </h2>
                <p className="text-gray-400">
                    Comece hoje mesmo, sem compromisso
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {PLANS.map((plan) => (
                    <GlassCard
                        key={plan.id}
                        className={`
              p-6 hover:scale-105 transition-transform cursor-pointer
              ${plan.popular ? 'ring-2 ring-pink-500' : ''}
            `}
                    >
                        {plan.popular && (
                            <div className="mb-4 -mt-3 -mx-3">
                                <div className="bg-gradient-to-r from-pink-500 to-violet-500 text-white text-xs font-semibold px-4 py-1 rounded-t-xl text-center">
                                    MAIS POPULAR
                                </div>
                            </div>
                        )}

                        <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                        <div className="text-3xl font-bold text-pink-400 mb-6">{plan.price}</div>

                        <ul className="space-y-3 mb-8">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                    <ChevronRight className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => onSelectPlan(plan.id)}
                            className={`
                w-full px-6 py-3 rounded-xl font-semibold
                transition-all
                ${plan.popular
                                    ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white hover:shadow-lg hover:shadow-pink-500/50'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }
              `}
                        >
                            {plan.id === 'community' ? 'Começar Grátis' : 'Assinar Agora'}
                        </button>
                    </GlassCard>
                ))}
            </div>

            <p className="text-center text-gray-500 text-xs mt-6">
                💳 Cancele quando quiser. Sem compromisso.
            </p>
        </motion.div>
    );
}
