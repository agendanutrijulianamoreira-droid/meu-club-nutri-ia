import { createClient } from "@supabase/supabase-js"

/**
 * Cliente Supabase para uso em Server Actions
 * Usa as mesmas credenciais do .env.local
 */
export function createServerClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
