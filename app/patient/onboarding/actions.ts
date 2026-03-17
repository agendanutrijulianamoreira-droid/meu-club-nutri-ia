'use server';

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const onboardingSchema = z.object({
    weight: z.string().min(1, "Peso é obrigatório"),
    height: z.string().min(1, "Altura é obrigatória"),
    mainGoal: z.string().min(1, "Selecione um objetivo"),
    painPoints: z.string(),
    dietaryRestrictions: z.string(),
    activityLevel: z.string().min(1, "Selecione o nível de atividade"),
});

export async function completeOnboarding(formData: FormData) {
    const supabase = createSupabaseServerClient(cookies());

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: "Não autorizado" };

    const rawData = Object.fromEntries(formData.entries());
    const parsed = onboardingSchema.safeParse(rawData);

    if (!parsed.success) return { error: "Verifique os dados preenchidos." };

    try {
        const painPoints = JSON.parse(parsed.data.painPoints) as string[];
        const dietaryRestrictions = JSON.parse(parsed.data.dietaryRestrictions) as string[];
        const weightNum = parseFloat(parsed.data.weight);
        const heightNum = parseInt(parsed.data.height, 10);

        const { error } = await supabase
            .from('profiles')
            .update({
                onboarding_completed: true,
                initial_weight: weightNum,
                current_weight: weightNum,
                primary_goal: parsed.data.mainGoal,
                dietary_restrictions: dietaryRestrictions,
                metadata: {
                    height: heightNum,
                    pain_points: painPoints,
                    activity_level: parsed.data.activityLevel,
                    onboarding_date: new Date().toISOString(),
                }
            })
            .eq('user_id', session.user.id);

        if (error) throw error;

    } catch (err: any) {
        console.error("[Onboarding] Erro:", err);
        return { error: "Erro ao salvar seus dados. Tente novamente." };
    }

    redirect('/patient/home?onboarded=true');
}
