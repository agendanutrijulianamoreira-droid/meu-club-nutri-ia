import Link from 'next/link';
import { ClipboardCheck, HeartPulse, Settings2 } from 'lucide-react';
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

function AdminDashboardWithAttention(props: DashboardProps) {
    return (
        <>
            <AdminDashboardClient {...props} />
            {props.tenantId && (
                <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-2">
                    <Link
                        href="/admin/methods/phases"
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-xs font-black text-slate-100 shadow-2xl shadow-black/30 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                        aria-label="Configurar critérios de avanço de fase"
                    >
                        <Settings2 size={17} />
                        Critérios de avanço
                    </Link>
                    <Link
                        href="/admin/followups"
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-xs font-black text-slate-100 shadow-2xl shadow-black/30 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                        aria-label="Abrir tarefas de acompanhamento"
                    >
                        <ClipboardCheck size={17} />
                        Tarefas de acompanhamento
                    </Link>
                    <Link
                        href="/admin/attention"
                        className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/30 bg-amber-300 px-4 py-3 text-xs font-black text-slate-950 shadow-2xl shadow-black/30 transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-slate-950"
                        aria-label="Abrir fila Quem precisa de mim hoje"
                    >
                        <HeartPulse size={17} />
                        Quem precisa de mim hoje?
                    </Link>
                </div>
            )}
        </>
    );
}

export default async function AdminPage() {
    const supabase = createSupabaseServerClient(cookies());
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        console.log("AdminPage: No session found, redirecting to login");
        redirect('/login');
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAdmin = serviceRoleKey
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
        : null;

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
    const isAdmin = ['admin', 'nutritionist'].includes(roleLower);

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

    const dashboardProps = { userName, tenantName, role: roleLower, tenantId: resolvedTenantId || '' };

    if (profile?.tenant_id && !isDemoTenant && isAdmin) {
        console.log("[Admin Guard] Access Granted (Standard)");
        return <AdminDashboardWithAttention {...dashboardProps} />;
    }

    if (isAdmin) {
        if (!profile?.tenant_id || isDemoTenant) {
            console.log("[Admin Guard] Missing real tenant for Admin. Passing needsRepair to client.");

            if (!supabaseAdmin) {
                console.warn("[Admin Guard] Autocura desativada: SUPABASE_SERVICE_ROLE_KEY ausente.");
                redirect('/admin/clinic');
            }

            const { data: ownedTenants } = await supabaseAdmin
                .from('tenants')
                .select('id, brand_name')
                .eq('owner_id', session.user.id)
                .limit(1);

            if (ownedTenants && ownedTenants.length > 0) {
                const previewTenantName = ownedTenants[0].brand_name || '';
                console.log("[Admin Guard] Found clinic, client will repair profile via Server Action.");
                return <AdminDashboardWithAttention
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

    if (session && !isAdmin) {
        console.log("[Admin Guard] User is not admin/nutritionist. Redirecting to patient home.");
        redirect('/patient/home');
    }

    if (session && isAdmin) {
        if (profile) return <AdminDashboardWithAttention {...dashboardProps} />;
    }

    console.log("[Admin Guard] Access Denied. Redirecting to login");
    redirect('/login');
}
