'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { z } from 'zod'

const onboardingSchema = z.object({
    initial_weight: z.number().min(20).max(300).optional(),
    current_weight: z.number().min(20).max(300).optional(),
    height: z.number().min(50).max(250).optional(),
    birth_date: z.string().optional(),
    gender: z.enum(['female', 'male', 'other', 'prefer_not_say']).optional(),
    primary_goal: z.string().min(3).max(200).optional(),
    goal_timeline_days: z.number().min(7).max(365).optional(),
    dietary_restrictions: z.array(z.string()).optional(),
})

/**
 * Server Action para salvar dados do onboarding do paciente
 */
export async function saveOnboardingData(data: z.infer<typeof onboardingSchema>) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return { error: 'Não autenticado' }
    }

    const parsed = onboardingSchema.safeParse(data)
    if (!parsed.success) {
        return { error: parsed.error.issues.map(i => i.message).join(', ') }
    }

    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            ...parsed.data,
            onboarding_completed: true,
            onboarding_step: 4, // Completed all steps
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

    if (updateError) {
        return { error: updateError.message }
    }

    return { success: true }
}

/**
 * Server Action para salvar progresso parcial do onboarding
 */
export async function saveOnboardingStep(step: number, data: Partial<z.infer<typeof onboardingSchema>>) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return { error: 'Não autenticado' }
    }

    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            ...data,
            onboarding_step: step,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

    if (updateError) {
        return { error: updateError.message }
    }

    return { success: true }
}
