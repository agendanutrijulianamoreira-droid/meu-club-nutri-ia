'use server';

import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"

/**
 * Server Action para criar novo usuário
 * Cria no Auth + cria perfil na tabela profiles
 */
export async function signupUser(formData: FormData) {
    const supabase = createSupabaseServerClient(cookies())
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const fullName = formData.get("fullName") as string
    const userType = (formData.get("userType") as string) || "patient"

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
