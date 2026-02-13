"use server"

import { createClient } from "@supabase/supabase-js"

// Credenciais do projeto correto
const supabaseUrl = "https://antszuxeairmbctwuafo.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFudHN6dXhlYWlybWJjdHd1YWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg4Mzk4MjAsImV4cCI6MjA1NDQxNTgyMH0.P7j2cz15I0T9TDq9TmHhZLYVJjkx_2IbLQqWqVFqjN8"

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Server Action para criar novo usuário
 * Cria no Auth + cria perfil na tabela profiles
 */
export async function signupUser(formData: FormData) {
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

        // 2. Criar perfil
        const { error: profileError } = await supabase.from("profiles").insert({
            user_id: authData.user.id,
            tenant_id: "00000000-0000-0000-0000-000000000001", // tenant demo
            name: fullName,
            email: email,
            current_plan: "community", // plano inicial gratuito
            nutri_coins: 100, // bônus de boas-vindas! 🎉
            total_xp: 0,
            current_level: 1,
            current_streak: 0,
            longest_streak: 0,
            primary_goal: null,
            dietary_restrictions: [],
        })

        if (profileError) {
            console.error("Erro ao criar perfil:", profileError)
            throw profileError
        }

        console.log("Perfil criado com sucesso!")

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
