import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | undefined

/**
 * Retorna uma instância única (singleton) do cliente Supabase para o browser.
 * Evita a criação de múltiplas conexões desnecessárias.
 */
export function getSupabaseBrowserClient() {
    if (client) return client

    client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    return client
}

// Export alternativo para facilitar uso direto
export const supabase = getSupabaseBrowserClient()
