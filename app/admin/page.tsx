import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import AdminDashboardClient from './AdminClientPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DashboardProps = {
    userName: string;
    tenantName: string;
    role: string;
    tenantId: string;
    needsRepair?: boolean;
};

type AdminPageProps = { searchParams?: { view?: string } };

function AdminDashboard(props: DashboardProps) {
    return <AdminDashboardClient {...props} />;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
    if (!searchParams?.view) redirect('/admin/dashboard');

    const supabase = createSupabaseServerClient(cookies());
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/login');

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAdmin = serviceRoleKey ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey) : null;
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

    let tenantName = '';
    const resolvedTenantId = profile?.tenant_id;
    if (resolvedTenantId && !isDemoTenant) {
        const { data: tenant } = await supabase.from('tenants').select('brand_name').eq('id', resolvedTenantId).single();
        tenantName = tenant?.brand_name || '';
    }

    const userName = profile?.name || session.user.email?.split('@')[0] || 'Admin';
    if (profileError) console.error('[Admin Guard] Profile Error:', profileError);
    const dashboardProps = { userName, tenantName, role: roleLower, tenantId: resolvedTenantId || '' };

    if (profile?.tenant_id && !isDemoTenant && isAdmin) return <AdminDashboard {...dashboardProps} />;

    if (isAdmin && (!profile?.tenant_id || isDemoTenant)) {
        if (!supabaseAdmin) redirect('/admin/clinic');
        const { data: ownedTenants } = await supabaseAdmin.from('tenants').select('id, brand_name').eq('owner_id', session.user.id).limit(1);
        if (ownedTenants && ownedTenants.length > 0) {
            return <AdminDashboard userName={userName} tenantName={ownedTenants[0].brand_name || ''} role="admin" tenantId={ownedTenants[0].id} needsRepair={true} />;
        }
        redirect('/admin/clinic');
    }

    if (session && !isAdmin) redirect('/patient/home');
    if (session && isAdmin && profile) return <AdminDashboard {...dashboardProps} />;
    redirect('/login');
}
