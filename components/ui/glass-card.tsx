'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

/**
 * GlassCard - Container padrão de card
 *
 * Fundo branco puro, borda sutil em Marrom Escuro e sombra leve.
 */
export function GlassCard({
  children,
  className,
  hoverable = false,
}: GlassCardProps) {

  return (
    <div
      className={cn(
        'relative rounded-2xl bg-white border border-[#2B1A10]/10 shadow-sm',
        hoverable && 'transition-opacity hover:opacity-90',
        className
      )}
    >
      {children}
    </div>
  );
}

// Variações pré-configuradas
export function GlassCardHero({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <GlassCard className={cn('p-8', className)}>
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
