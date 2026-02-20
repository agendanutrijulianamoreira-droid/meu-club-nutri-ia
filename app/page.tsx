import { GlassCard } from '@/components/ui/glass-card';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = createSupabaseServerClient(cookies());
  const { data: { session } } = await supabase.auth.getSession();

  // Se estiver logado, tenta redirecionar para a área correta (Healing)
  if (session) {
    const userMetadata = session.user.user_metadata;
    let userRole = userMetadata?.user_type || userMetadata?.role;

    // Se o metadata estiver vazio (sessão antiga), faz o check no banco
    if (!userRole) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (profile) {
        userRole = profile.role;
        // Tenta atualizar o metadata para a próxima vez (background healing)
        // Nota: updateUser em Server Component pode não refletir na sessão atual imediatamente sem refresh de cookie
      }
    }

    const normalizedUserRole = (userRole || '').toLowerCase();

    if (['admin', 'nutritionist', 'nutri'].includes(normalizedUserRole)) {
      // Check for tenant_id specifically for admins/nutris
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();

      const isDemoTenant = profile?.tenant_id === '00000000-0000-0000-0000-000000000001';

      if (!profile?.tenant_id || isDemoTenant) {
        redirect('/admin/clinic');
      }
      redirect('/admin');
    } else if (userRole === 'patient') {
      redirect('/patient/home');
    }
  }

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
            href="/login"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 text-white font-semibold hover:shadow-lg hover:shadow-pink-500/50 transition-all"
          >
            Acessar Portal
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
