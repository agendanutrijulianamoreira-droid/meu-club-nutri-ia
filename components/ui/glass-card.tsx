'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  gradient?: boolean;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * GlassCard - Container padrão com Glassmorphism
 * 
 * Estética Dark Mode + Translúcido
 * - backdrop-blur-xl para efeito de vidro
 * - Bordas brancas com 10% opacidade
 * - Sombras suaves para profundidade
 */
export function GlassCard({
  children,
  className,
  hoverable = false,
  gradient = false,
  blur = 'xl'
}: GlassCardProps) {

  const blurLevels = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl'
  };

  return (
    <motion.div
      className={cn(
        // Base: Glassmorphism
        'relative rounded-2xl',
        blurLevels[blur],
        'bg-white/5',
        'border border-white/10',
        'shadow-2xl shadow-black/20',

        // Gradiente sutil (opcional)
        gradient && 'bg-gradient-to-br from-white/10 to-transparent',

        // Hover effect
        hoverable && 'transition-all duration-300 hover:bg-white/10 hover:shadow-pink-500/20',

        className
      )}
      initial={hoverable ? { scale: 1 } : undefined}
      whileHover={hoverable ? { scale: 1.02, y: -2 } : undefined}
      transition={{ duration: 0.2 }}
    >
      {/* Brilho sutil no topo (efeito de luz) */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {children}
    </motion.div>
  );
}

// Variações pré-configuradas
export function GlassCardHero({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <GlassCard
      className={cn('p-8', className)}
      gradient
      blur="lg"
    >
      {children}
    </GlassCard>
  );
}

export function GlassCardCompact({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <GlassCard
      className={cn('p-4', className)}
      hoverable
    >
      {children}
    </GlassCard>
  );
}
