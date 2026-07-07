'use server';

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const onboardingSchema = z.object({
    weight: z.string().min(1, "Peso é obrigatório"),
    height: z.string().min(1, "Altura é obrigatória"),
    mainGoal: z.string().min(1, "Selecione um objetivo"),
    painPoints: z.string() // Array stringificado (JSON) das dores
});

export async function completeOnboarding(formData: FormData) {
    const supabase = createSupabaseServerClient(cookies());

    // 1. Pega o usuário logado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: "Não autorizado" };

    const rawData = Object.fromEntries(formData.entries());
    const parsed = onboardingSchema.safeParse(rawData);

    if (!parsed.success) return { error: "Verifique os dados preenchidos." };

    try {
        // 2. Salva as informações iniciais no perfil do paciente
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('settings')
            .eq('user_id', session.user.id)
            .single();

        const weight = parseFloat(parsed.data.weight);
        const height = parseFloat(parsed.data.height);

        const { error } = await supabase
            .from('profiles')
            .update({
                onboarding_completed: true,
                initial_weight: weight,
                current_weight: weight,
                height: height,
                primary_goal: parsed.data.mainGoal,
                settings: {
                    ...(currentProfile?.settings ?? {}),
                    pain_points: JSON.parse(parsed.data.painPoints),
                },
            })
            .eq('user_id', session.user.id);

        if (error) throw error;

    } catch (err: any) {
        console.error("Erro no onboarding:", err);
        return { error: "Erro ao salvar seus dados. Tente novamente." };
    }

    // 3. Redireciona para a Home destravada
    redirect('/patient/home?onboarded=true');
}
