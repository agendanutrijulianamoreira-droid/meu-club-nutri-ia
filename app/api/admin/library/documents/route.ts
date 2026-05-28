import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(_request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('library_documents')
    .select('id, title, description, user_hint, file_name, file_type, detected_type, ai_summary, ai_tags, status, items_created, created_at, processed_at, file_size_bytes')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[LibraryDocs]', error)
    return NextResponse.json({ error: 'Erro ao buscar documentos' }, { status: 500 })
  }

  return NextResponse.json({ documents: data || [] })
}
