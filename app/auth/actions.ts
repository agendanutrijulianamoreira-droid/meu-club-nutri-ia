'use server';

import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { z } from "zod"

const signupSchema = z.object({
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    userType: z.enum(['patient', 'nutritionist', 'admin']).default('patient')
})

/**
 * Server Action para criar novo usuário
 * Cria no Auth + cria perfil na tabela profiles
 */
export async function signupUser(formData: FormData) {
    const supabase = createSupabaseServerClient(cookies())

    const parsed = signupSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
        fullName: formData.get("fullName"),
        userType: formData.get("userType") || "patient"
    })

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }
    }

    const { email, password, fullName, userType } = parsed.data

    console.log("Criando usuário:", email)

    try {
        // 1. Criar no Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    user_type: userType,
                },
            },
        })

        if (authError) throw authError
        if (!authData.user) throw new Error("Falha ao criar usuário")

        console.log("Usuário criado no Auth:", authData.user.id)
        console.log("Perfil será criado automaticamente pelo trigger do banco.")

        return {
            success: true,
            message: "Conta criada! Você ganhou 100 NutriCoins de boas-vindas! 🎉",
        }
    } catch (error: any) {
        console.error("Erro ao criar usuário:", error)
        return {
            success: false,
            error: error.message || "Erro ao criar conta",
        }
    }
}
