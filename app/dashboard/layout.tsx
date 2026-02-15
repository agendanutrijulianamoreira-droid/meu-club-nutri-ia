"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-browser"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter()

    // Proteção extra: Redirecionar nutris que caírem aqui por engano
    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                let userType = user.user_metadata?.user_type || user.user_metadata?.role;

                // Se não tiver metadata, verifica no banco como última instância
                if (!userType) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('user_id', user.id)
                        .single();
                    if (profile) userType = profile.role;
                }

                if (userType === 'nutri' || userType === 'nutritionist' || userType === 'admin') {
                    router.push('/admin')
                }
            }
        }
        checkRole()
    }, [router])

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1744] to-[#0f0c29]">
            {children}
        </div>
    );
}
