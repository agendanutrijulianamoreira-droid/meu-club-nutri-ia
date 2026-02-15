import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminDashboardClient from './AdminClientPage';

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

    console.log("AdminPage Check:", {
        userId: session.user.id,
        tenantId: profile?.tenant_id,
        isDemoTenant,
        dbRole,
        metadataRole,
        finalRole: role
    });

    const isAdmin = ['admin', 'nutritionist', 'nutri'].includes((role || '').toLowerCase());

    if (!profile?.tenant_id || isDemoTenant) {
        if (isAdmin) {
            console.log("AdminPage: Missing or demo tenant for admin/nutri, redirecting to onboarding");
            redirect('/admin/clinic');
        } else if (role === 'patient') {
            console.log("AdminPage: User is patient, redirecting to patient home");
            redirect('/patient/home');
        } else {
            console.log("AdminPage: Role undefined or unauthorized, redirecting to login");
            redirect('/login');
        }
    }

    console.log("AdminPage: Access granted to dashboard");
    return <AdminDashboardClient />;
}
