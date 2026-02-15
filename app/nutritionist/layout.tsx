import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { redirect } from 'next/navigation'

export default async function NutritionistLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createSupabaseServerClient(cookies())

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Verificar se é nutricionista
    const { data: professionalProfile } = await supabase
        .from('professional_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (!professionalProfile) {
        // Não é nutricionista, redireciona para dashboard normal
        redirect('/dashboard')
    }

    // Se está inativo, bloquear acesso
    if (professionalProfile.status !== 'active') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">Acesso Suspenso</h1>
                    <p className="text-slate-400">
                        Seu perfil de nutricionista está {professionalProfile.status === 'pending' ? 'pendente de aprovação' : 'inativo'}.
                        Entre em contato com o suporte para mais informações.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
            {children}
        </div>
    )
}
