import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
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

    // Admin client para bypassing RLS (Autocura)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAdmin = serviceRoleKey
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
        : null;

    // Get profile to check tenant_id and role
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id, role, name')
        .eq('user_id', session.user.id)
        .single();

    const dbRole = profile?.role;
    const metadataRole = session.user.user_metadata?.user_type || session.user.user_metadata?.role;
    const role = dbRole || metadataRole;
    const isDemoTenant = profile?.tenant_id === '00000000-0000-0000-0000-000000000001';

    const roleLower = (role || '').toLowerCase();
    const isAdmin = ['admin', 'nutritionist', 'nutri'].includes(roleLower);

    // Fetch tenant brand_name using the resolved tenant_id
    let tenantName = '';
    const resolvedTenantId = profile?.tenant_id;
    if (resolvedTenantId && !isDemoTenant) {
        const { data: tenant } = await supabase
            .from('tenants')
            .select('brand_name')
            .eq('id', resolvedTenantId)
            .single();
        tenantName = tenant?.brand_name || '';
    }

    const userName = profile?.name || session.user.email?.split('@')[0] || 'Admin';

    console.log("[Admin Guard] Status:", {
        userId: session.user.id,
        email: session.user.email,
        dbTenantId: profile?.tenant_id,
        dbRole: profile?.role,
        metadata: session.user.user_metadata,
        isDemoTenant,
        calculatedRole: roleLower,
        isAdmin,
        userName,
        tenantName
    });

    if (profileError) {
        console.error("[Admin Guard] Profile Error:", profileError);
    }

    // Props to pass to client dashboard
    const dashboardProps = { userName, tenantName, role: roleLower, tenantId: resolvedTenantId || '' };

    // 1. Caminho Padrão: Tenant Válido (Não Demo) + Admin
    if (profile?.tenant_id && !isDemoTenant && isAdmin) {
        console.log("[Admin Guard] Access Granted (Standard)");
        return <AdminDashboardClient {...dashboardProps} />;
    }

    // 2. Autocura / Redirecionamento: Se o perfil está sem tenant ou no demo, 
    // mas o usuário é admin/nutri, verificamos se ele já tem algo criado.
    if (isAdmin) {
        // Se está no demo ou sem tenant, tenta achar clínica própria via SERVICE ROLE (bypassing RLS)
        if (!profile?.tenant_id || isDemoTenant) {
            console.log("[Admin Guard] Missing real tenant for Admin.");

            if (!supabaseAdmin) {
                console.warn("[Admin Guard] Autocura desativada: SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local");
                redirect('/admin/clinic');
            }

            console.log("[Admin Guard] Scanning via Service Role...");

            const { data: ownedTenants } = await supabaseAdmin
                .from('tenants')
                .select('id, brand_name')
                .eq('owner_id', session.user.id)
                .limit(1);

            if (ownedTenants && ownedTenants.length > 0) {
                const realTenantId = ownedTenants[0].id;
                const repairedTenantName = ownedTenants[0].brand_name || '';
                console.log("[Admin Guard] Service Role found owned clinic:", realTenantId);

                // Reparo forçado do perfil para evitar o loop
                await supabaseAdmin
                    .from('profiles')
                    .update({ tenant_id: realTenantId, role: 'admin' })
                    .eq('user_id', session.user.id);

                console.log("[Admin Guard] Profile repaired. Refreshing dashboard...");
                return <AdminDashboardClient userName={userName} tenantName={repairedTenantName} role="admin" tenantId={realTenantId} />;
            }

            console.log("[Admin Guard] No owned clinic found even via Admin scan. Redirecting to onboarding...");
            redirect('/admin/clinic');
        }
    }

    // 3. Redirecionamento de Paciente
    if (roleLower === 'patient') {
        console.log("[Admin Guard] Redirecting patient to home");
        redirect('/patient/home');
    }

    // 4. Fallback de Segurança: Se logado, tenta carregar o dashboard
    if (session) {
        console.log("[Admin Guard] Fallback granted for authenticated user");
        return <AdminDashboardClient {...dashboardProps} />;
    }

    console.log("[Admin Guard] Final fallback to login");
    redirect('/login');
}
