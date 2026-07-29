'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, Send } from 'lucide-react';
import { GlassCard } from '../ui/glass-card';

interface PanicButtonProps {
    userId: string;
    userPlan: 'community' | 'tech_diet' | 'vip';
    onSend?: (message: string) => void;
}

/**
 * PanicButton - Botão "SOS Nutri" (apenas VIP)
 * 
 * Features:
 * - Botão flutuante discreto
 * - Modal para enviar mensagem urgente
 * - Priorização na fila de atendimento
 * - Apenas para plano VIP
 */
export function PanicButton({ userId, userPlan, onSend }: PanicButtonProps) {

    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Apenas VIP tem acesso
    if (userPlan !== 'vip') {
        return null;
    }

    const handleSend = async () => {
        if (!message.trim()) return;

        setIsSending(true);

        try {
            // TODO: Enviar para Supabase + notificar nutricionista
            // await createPanicRequest(userId, message);

            if (onSend) {
                onSend(message);
            }

            // Limpar e fechar
            setMessage('');
            setIsOpen(false);

            // Feedback visual
            alert('🚨 SOS enviado! Sua nutricionista será notificada imediatamente.');
        } catch (error) {
            console.error('Erro ao enviar SOS:', error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            {/* Botão Flutuante */}
            <motion.button
                onClick={() => setIsOpen(true)}
                className="
          fixed bottom-24 right-6 z-50
          w-14 h-14 rounded-full
          bg-red-600 shadow-md
          flex items-center justify-center
          hover:bg-red-500
          transition-colors duration-300
        "
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.95 }}
            >
                <AlertCircle className="w-6 h-6 text-white" />
            </motion.button>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Modal Content */}
                        <motion.div
                            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto"
                            initial={{ opacity: 0, scale: 0.9, y: '-40%' }}
                            animate={{ opacity: 1, scale: 1, y: '-50%' }}
                            exit={{ opacity: 0, scale: 0.9, y: '-40%' }}
                        >
                            <GlassCard className="p-6">

                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                            <AlertCircle className="w-6 h-6 text-red-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-serif text-[#2B1A10]">
                                                SOS Nutri
                                            </h3>
                                            <p className="text-xs text-[#2B1A10]/50">
                                                Atendimento prioritário VIP
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="text-[#2B1A10]/40 hover:text-[#2B1A10] transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Info */}
                                <div className="mb-4 p-3 rounded-lg bg-[#C9A435]/10 border border-[#C9A435]/25">
                                    <p className="text-xs text-[#2B1A10]/80">
                                        <strong>Benefício VIP:</strong> Sua mensagem será priorizada e
                                        sua nutricionista receberá notificação imediata.
                                    </p>
                                </div>

                                {/* Textarea */}
                                <div className="mb-4">
                                    <label className="block text-sm text-[#2B1A10]/70 mb-2">
                                        O que está acontecendo?
                                    </label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Ex: Tive uma recaída e preciso de orientação urgente..."
                                        rows={4}
                                        className="
                      w-full px-4 py-3 rounded-xl
                      bg-[#2B1A10]/[0.03] border border-[#2B1A10]/15
                      text-[#2B1A10] placeholder-[#2B1A10]/30
                      focus:outline-none focus:border-[#C9A435]
                      transition-colors
                    "
                                        maxLength={500}
                                    />
                                    <div className="text-right text-xs text-[#2B1A10]/40 mt-1">
                                        {message.length}/500
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="
                      flex-1 px-4 py-3 rounded-xl
                      bg-[#2B1A10]/5 border border-[#2B1A10]/15
                      text-[#2B1A10] font-medium
                      hover:bg-[#2B1A10]/10
                      transition-colors
                    "
                                    >
                                        Cancelar
                                    </button>

                                    <button
                                        onClick={handleSend}
                                        disabled={!message.trim() || isSending}
                                        className="
                      flex-1 px-4 py-3 rounded-xl
                      bg-red-600 hover:bg-red-500
                      text-white font-medium
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors
                      flex items-center justify-center gap-2
                    "
                                    >
                                        {isSending ? (
                                            <motion.div
                                                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            />
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Enviar SOS
                                            </>
                                        )}
                                    </button>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
