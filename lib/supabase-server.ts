import { createServerClient, type CookieOptions } from '@supabase/ssr'

/**
 * Cria um cliente Supabase para o servidor (Server Components, Actions, Route Handlers).
 * Gerencia automaticamente os cookies de sessão.
 */
export function createSupabaseServerClient() {
    const { cookies } = require('next/headers')
    const cookieStore = cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch (error) {
                        // Silencioso em Server Components (não pode setar cookie lá)
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch (error) {
                        // Silencioso em Server Components
                    }
                },
            },
        }
    )
}
