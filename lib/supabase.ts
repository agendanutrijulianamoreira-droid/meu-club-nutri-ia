import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente Supabase para uso no lado do cliente (browser)
 * Usado nos componentes e hooks
 */
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// Export direto para compatibilidade com imports existentes
export const supabase = createClient();
