import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getAuthTenant(supabase: ReturnType<typeof createSupabaseServerClient>) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id, settings')
        .eq('owner_id', user.id)
        .single()
    return tenant
}

export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const tenant = await getAuthTenant(supabase)
    if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const vip = (tenant.settings as Record<string, any>)?.vip ?? {}
    return NextResponse.json({ vip })
}

export async function PATCH(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const tenant = await getAuthTenant(supabase)
    if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const currentSettings = (tenant.settings as Record<string, any>) ?? {}
    const updatedSettings = { ...currentSettings, vip: { ...(currentSettings.vip ?? {}), ...body } }

    const { error } = await supabase
        .from('tenants')
        .update({ settings: updatedSettings })
        .eq('id', tenant.id)

    if (error) {
        console.error('[vip-settings PATCH]', error)
        return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
