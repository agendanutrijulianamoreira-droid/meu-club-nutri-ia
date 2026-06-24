import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, current_plan')
        .eq('user_id', user.id)
        .single()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: tenant } = await supabase
        .from('tenants')
        .select('name, settings')
        .eq('id', profile.tenant_id)
        .single()

    const vip = (tenant?.settings as Record<string, any>)?.vip ?? {}

    return NextResponse.json({
        vip: {
            enabled: vip.enabled ?? false,
            price_monthly: vip.price_monthly ?? 97,
            price_annual: vip.price_annual ?? 797,
            benefits: vip.benefits ?? [],
            video_url: vip.video_url ?? '',
            cta_text: vip.cta_text ?? 'Quero ser VIP 👑',
            badge_label: vip.badge_label ?? 'VIP',
        },
        tenant_name: tenant?.name ?? '',
        current_plan: profile.current_plan ?? 'community',
    })
}
