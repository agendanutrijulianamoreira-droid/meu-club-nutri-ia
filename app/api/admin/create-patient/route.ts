import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { OnboardingService } from '@/lib/services/onboarding'

const ALLOWED_PLANS = new Set(['manual', 'community', 'tech_diet', 'vip'])
const STAFF_ROLES = new Set(['admin', 'nutritionist', 'nutri'])

export async function POST(request: NextRequest) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAdmin = serviceRoleKey
        ? createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )
        : null

    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Server configuration incomplete' }, { status: 500 })
    }

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !currentUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: requesterProfile } = await supabaseAdmin
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', currentUser.id)
        .maybeSingle()

    const roleLower = String(requesterProfile?.role || '').toLowerCase()
    let tenantId = requesterProfile?.tenant_id || null
    let isAuthorized = STAFF_ROLES.has(roleLower)

    // Ownership is a server-side database fact and may recover legacy owner
    // accounts whose profile role has not yet been normalized.
    if (!tenantId || !isAuthorized) {
        const { data: ownedTenant } = await supabaseAdmin
            .from('tenants')
            .select('id')
            .eq('owner_id', currentUser.id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()

        if (ownedTenant?.id) {
            tenantId = ownedTenant.id
            isAuthorized = true
        }
    }

    if (!tenantId || !isAuthorized) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await request.json()
        const email = String(body?.email || '').trim().toLowerCase()
        const password = String(body?.password || '')
        const name = String(body?.name || '').trim()
        const phone = body?.phone ? String(body.phone).trim().slice(0, 30) : null
        const plan = String(body?.plan || 'manual').toLowerCase()

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 8 || name.length < 2) {
            return NextResponse.json(
                { error: 'Nome, e-mail válido e senha de pelo menos 8 caracteres são obrigatórios' },
                { status: 400 }
            )
        }

        if (!ALLOWED_PLANS.has(plan)) {
            return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
        }

        const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: name },
        })

        if (authCreateError || !authData.user) {
            const duplicate = authCreateError?.code === 'email_exists' || authCreateError?.message?.includes('already')
            return NextResponse.json(
                { error: duplicate ? 'Este e-mail já está cadastrado.' : 'Não foi possível criar o acesso do paciente.' },
                { status: duplicate ? 409 : 500 }
            )
        }

        const userId = authData.user.id

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                user_id: userId,
                tenant_id: tenantId,
                name,
                email,
                phone,
                role: 'patient',
                current_plan: plan,
                nutri_coins: 100,
                total_xp: 0,
                current_level: 1,
            }, { onConflict: 'user_id' })

        if (profileError) {
            console.error('[create-patient] Profile upsert error:', profileError)
            await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined)
            return NextResponse.json({ error: 'Não foi possível configurar o perfil do paciente.' }, { status: 500 })
        }

        const { error: subscriptionError } = await supabaseAdmin.from('subscriptions').insert({
            user_id: userId,
            tenant_id: tenantId,
            plan,
            status: 'active',
            gateway: 'manual',
            updated_at: new Date().toISOString(),
        })

        if (subscriptionError) {
            console.error('[create-patient] Subscription error:', subscriptionError)
        }

        let emailSent = false
        try {
            const result = await OnboardingService.sendWelcomeMessages(userId, tenantId, { password })
            emailSent = result.emailSent
        } catch (err) {
            console.error('[create-patient] Onboarding error:', err)
        }

        return NextResponse.json({
            success: true,
            user_id: userId,
            email_sent: emailSent,
            warning: subscriptionError ? 'Paciente criado, mas a assinatura precisa ser revisada.' : undefined,
        })
    } catch (error: any) {
        console.error('[create-patient] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
