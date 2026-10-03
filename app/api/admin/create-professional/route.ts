import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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
        console.error('API Error: SUPABASE_SERVICE_ROLE_KEY is missing')
        return NextResponse.json({ error: 'Configuração do servidor incompleta (Service Role)' }, { status: 500 })
    }

    // Authorization must be derived exclusively from trusted database state.
    // user_metadata is user-editable and must never grant privileged access.
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user: currentUser }, error: authUserError } = await supabase.auth.getUser()

    if (authUserError || !currentUser) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: requesterProfile } = await supabaseAdmin
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', currentUser.id)
        .maybeSingle()

    const roleLower = String(requesterProfile?.role || '').toLowerCase()
    let tenantId = requesterProfile?.tenant_id || null
    let isAuthorized = STAFF_ROLES.has(roleLower)

    // Legacy tenant owners may not yet have a normalized staff profile.
    // Ownership is a server-side database fact, so it is safe as a fallback.
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
        return NextResponse.json({ error: 'Acesso negado ou clínica não encontrada.' }, { status: 403 })
    }

    try {
        const body = await request.json()
        const email = String(body?.email || '').trim().toLowerCase()
        const password = String(body?.password || '')
        const name = String(body?.name || '').trim()
        const commissionRate = Number(body?.commission_rate ?? 10)
        const isModerator = Boolean(body?.is_moderator)
        const hasAgenda = Boolean(body?.has_agenda)
        const pixKey = body?.pix_key ? String(body.pix_key).trim().slice(0, 200) : null

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || name.length < 2) {
            return NextResponse.json(
                { error: 'Nome, e-mail válido e senha de pelo menos 8 caracteres são obrigatórios' },
                { status: 400 }
            )
        }

        if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
            return NextResponse.json({ error: 'Taxa de comissão inválida' }, { status: 400 })
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name },
        })

        if (authError || !authData.user) {
            const duplicate = authError?.code === 'email_exists' || authError?.message?.includes('already')
            return NextResponse.json(
                { error: duplicate ? 'Este e-mail já está cadastrado.' : 'Não foi possível criar o acesso do profissional.' },
                { status: duplicate ? 409 : 500 }
            )
        }

        const userId = authData.user.id

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                user_id: userId,
                tenant_id: tenantId,
                name,
                email,
                role: 'nutritionist',
                current_plan: 'professional',
                nutri_coins: 0,
                total_xp: 0,
                current_level: 1,
                current_streak: 0,
                longest_streak: 0,
            })

        if (profileError) {
            console.error('[create-professional] Profile insert failed:', profileError)
            await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined)
            return NextResponse.json({ error: 'Não foi possível configurar o perfil profissional.' }, { status: 500 })
        }

        const { error: professionalError } = await supabaseAdmin
            .from('professional_profiles')
            .insert({
                user_id: userId,
                tenant_id: tenantId,
                commission_rate: commissionRate,
                is_moderator: isModerator,
                has_agenda: hasAgenda,
                pix_key: pixKey,
                status: 'active',
            })

        if (professionalError) {
            console.error('[create-professional] Professional profile insert failed:', professionalError)
            await supabaseAdmin.from('profiles').delete().eq('user_id', userId)
            await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined)
            return NextResponse.json({ error: 'Não foi possível configurar o perfil profissional.' }, { status: 500 })
        }

        return NextResponse.json({ success: true, user_id: userId, message: 'Profissional cadastrado com sucesso!' })
    } catch (error) {
        console.error('[create-professional] Unexpected error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
}
