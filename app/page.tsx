import { GlassCard } from '@/components/ui/glass-card';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1744] to-[#0f0c29] flex items-center justify-center p-4">
      <GlassCard className="p-12 max-w-2xl text-center">
        <h1 className="text-5xl font-bold text-white mb-4">
          Meu Club Nutri.AI 👑
        </h1>
        <p className="text-gray-300 text-lg mb-8">
          Plataforma de nutrição gamificada com IA
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 text-white font-semibold hover:shadow-lg hover:shadow-pink-500/50 transition-all"
          >
            Acessar Dashboard
          </Link>
        </div>

        <div className="mt-12 text-sm text-gray-500">
          <p>✨ Gamificação com NutriCoins</p>
          <p>🤖 Magic AI Generator</p>
          <p>🎯 Sistema de Não-Punição</p>
        </div>
      </GlassCard>
    </div>
  );
}
