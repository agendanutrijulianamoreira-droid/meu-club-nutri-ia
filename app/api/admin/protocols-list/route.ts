import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: protocols } = await supabase
        .from('protocols')
        .select('id, title, duration_days, emoji')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    return NextResponse.json({ protocols: protocols || [] })
}
