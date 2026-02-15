import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminDashboardClient from './AdminClientPage';

export default async function AdminPage() {
    const supabase = createSupabaseServerClient(cookies());
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirect('/login');
    }

    // Get profile to check tenant_id and role
    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', session.user.id)
        .single();

    if (!profile || !profile.tenant_id) {
        const role = profile?.role;
        const isAdmin = role === 'admin' || role === 'nutritionist' || role === 'nutri';

        if (isAdmin) {
            redirect('/admin/clinic');
        } else {
            // Se for paciente tentando acessar /admin, manda para home do paciente
            if (role === 'patient') {
                redirect('/patient/home');
            }
            redirect('/login');
        }
    }

    return <AdminDashboardClient />;
}
