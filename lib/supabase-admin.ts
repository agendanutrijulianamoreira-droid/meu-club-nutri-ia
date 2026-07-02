import { createClient } from '@supabase/supabase-js'

// Cliente com service role — uso restrito a rotas de servidor que precisam
// bypassar RLS (uploads, geração de leads públicos, jobs administrativos).
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
