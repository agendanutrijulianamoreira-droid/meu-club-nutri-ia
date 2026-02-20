"use server"

import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export async function updatePublicSetting(key: string, value: any) {
    const supabase = createSupabaseServerClient(cookies())

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Não autorizado")

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        if (profile?.role !== 'admin') throw new Error("Apenas administradores podem alterar configurações globais.")

        const { error } = await supabase
            .from('public_settings')
            .upsert({ key, value, updated_at: new Date().toISOString() })

        if (error) throw error

        revalidatePath('/login')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
