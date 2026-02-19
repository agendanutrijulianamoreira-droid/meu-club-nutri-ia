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

    // 2. Autocura: Se admin sem tenant real, detectar mas NÃO mutar durante render.
    // A mutação será feita pelo client via Server Action (repairProfileAction).
    if (isAdmin) {
        if (!profile?.tenant_id || isDemoTenant) {
            console.log("[Admin Guard] Missing real tenant for Admin. Passing needsRepair to client.");

            if (!supabaseAdmin) {
                console.warn("[Admin Guard] Autocura desativada: SUPABASE_SERVICE_ROLE_KEY ausente.");
                redirect('/admin/clinic');
            }

            // Apenas LEITURA: verificar se existe clínica para exibir o dashboard
            const { data: ownedTenants } = await supabaseAdmin
                .from('tenants')
                .select('id, brand_name')
                .eq('owner_id', session.user.id)
                .limit(1);

            if (ownedTenants && ownedTenants.length > 0) {
                // Tem clínica, mas perfil está desatualizado → client vai reparar
                const previewTenantName = ownedTenants[0].brand_name || '';
                console.log("[Admin Guard] Found clinic, client will repair profile via Server Action.");
                return <AdminDashboardClient
                    userName={userName}
                    tenantName={previewTenantName}
                    role="admin"
                    tenantId={ownedTenants[0].id}
                    needsRepair={true}
                />;
            }

            console.log("[Admin Guard] No owned clinic found. Redirecting to onboarding...");
            redirect('/admin/clinic');
        }
    }

    // 4. Fallback de Segurança: Se não for admin, tchau!
    // P0 Review fix: Sem fallback "bonzinho". Se não é admin/nutri, é paciente.
    if (session && !isAdmin) {
        console.log("[Admin Guard] User is not admin/nutritionist. Redirecting to patient home.");
        redirect('/patient/home');
    }

    // Se chegou aqui e é admin, mas não caiu nos casos acima (ex: erro de leitura do profile), 
    // manda para login por segurança
    if (session && isAdmin) {
        // Caso de borda: admin autenticado mas sem tenant resolvido (e não demo) e autocura falhou?
        // Deixa passar se tiver profile, senão login.
        if (profile) return <AdminDashboardClient {...dashboardProps} />;
    }

    console.log("[Admin Guard] Access Denied. Redirecting to login.");
    redirect('/login');
}
