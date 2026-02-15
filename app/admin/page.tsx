import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminDashboardClient from './AdminClientPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage() {
    const supabase = createSupabaseServerClient(cookies());
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        console.log("AdminPage: No session found, redirecting to login");
        redirect('/login');
    }

    // Get profile to check tenant_id and role
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', session.user.id)
        .single();

    if (error) {
        console.error("AdminPage: Error fetching profile:", error);
    }

    const dbRole = profile?.role;
    const metadataRole = session.user.user_metadata?.user_type || session.user.user_metadata?.role;
    const role = dbRole || metadataRole;

    const isDemoTenant = profile?.tenant_id === '00000000-0000-0000-0000-000000000001';

    // Log detalhado para depuração (visível no servidor)
    console.log("AdminPage Check:", {
        userId: session.user.id,
        tenantId: profile?.tenant_id,
        isDemoTenant,
        dbRole,
        metadataRole,
        finalRole: role
    });

    const roleLower = (role || '').toLowerCase();
    const isAdmin = ['admin', 'nutritionist', 'nutri'].includes(roleLower);

    // Se temos um tenant válido E somos admin, entra direto
    if (profile?.tenant_id && !isDemoTenant && isAdmin) {
        console.log("AdminPage: Access granted");
        return <AdminDashboardClient />;
    }

    // Se não temos tenant ou é demo, mas somos admin, vai para onboarding
    if ((!profile?.tenant_id || isDemoTenant) && isAdmin) {
        console.log("AdminPage: Missing or demo tenant for admin/nutri, redirecting to onboarding");
        redirect('/admin/clinic');
    }

    // Se for explicitamente paciente, vai para home de paciente
    if (roleLower === 'patient') {
        console.log("AdminPage: User is patient, redirecting to patient home");
        redirect('/patient/home');
    }

    // Caso de fallback: Se chegamos aqui e estamos autenticados, mas o perfil ainda não carregou 
    // ou o tenant acabou de ser criado e o cache está teimoso.
    // Em vez de chutar para o login, tentamos renderizar o dashboard (autoproteção via client-side se necessário)
    // ou mostramos uma tela de carregamento/erro amigável.
    if (session) {
        console.log("AdminPage: Fallback access for authenticated user");
        return <AdminDashboardClient />;
    }

    console.log("AdminPage: Final fallback, redirecting to login");
    redirect('/login');
}
