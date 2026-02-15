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
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', session.user.id)
        .single();

    const dbRole = profile?.role;
    const metadataRole = session.user.user_metadata?.user_type || session.user.user_metadata?.role;
    const role = dbRole || metadataRole;
    const isDemoTenant = profile?.tenant_id === '00000000-0000-0000-0000-000000000001';

    const roleLower = (role || '').toLowerCase();
    const isAdmin = ['admin', 'nutritionist', 'nutri'].includes(roleLower);

    console.log("[Admin Guard] Status:", {
        userId: session.user.id,
        tenantId: profile?.tenant_id,
        isDemoTenant,
        role: roleLower,
        isAdmin
    });

    // 1. Caminho Padrão: Tenant Válido + Admin
    if (profile?.tenant_id && !isDemoTenant && isAdmin) {
        console.log("[Admin Guard] Access Granted (Standard)");
        return <AdminDashboardClient />;
    }

    // 2. Autocura: Se o perfil está sem tenant ou no demo, mas o usuário é admin,
    // verificamos se ele JÁ possui um tenant criado (evita delay de sync do perfil)
    if ((!profile?.tenant_id || isDemoTenant) && isAdmin) {
        console.log("[Admin Guard] Missing tenant for Admin. Scanning for owned clinics...");
        const { data: ownedTenants } = await supabase
            .from('tenants')
            .select('id')
            .eq('owner_id', session.user.id)
            .limit(1);

        if (ownedTenants && ownedTenants.length > 0) {
            console.log("[Admin Guard] Self-healing found owned clinic:", ownedTenants[0].id);
            return <AdminDashboardClient />;
        }

        console.log("[Admin Guard] No owned clinic found. Redirecting to onboarding...");
        redirect('/admin/clinic');
    }

    // 3. Redirecionamento de Paciente
    if (roleLower === 'patient') {
        console.log("[Admin Guard] Redirecting patient to home");
        redirect('/patient/home');
    }

    // 4. Fallback de Segurança: Se logado, tenta carregar o dashboard
    if (session) {
        console.log("[Admin Guard] Fallback granted for authenticated user");
        return <AdminDashboardClient />;
    }

    console.log("[Admin Guard] Final fallback to login");
    redirect('/login');
}
