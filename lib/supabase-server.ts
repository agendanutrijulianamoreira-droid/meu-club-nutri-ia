import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

/**
 * Cria um cliente Supabase para o servidor (Server Components, Actions, Route Handlers).
 * Aceita o cookieStore como argumento para evitar importação direta de next/headers.
 */
export function createSupabaseServerClient(cookieStore: any) {
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
