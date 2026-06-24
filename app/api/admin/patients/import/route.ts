import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface ImportRow {
    name: string
    email: string
    phone?: string
    plan?: string
    primary_goal?: string
}

interface ImportResult {
    email: string
    name: string
    status: 'success' | 'error'
    error?: string
    temp_password?: string
}

function generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let pw = ''
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
    return pw
}

export async function POST(request: NextRequest) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return NextResponse.json({ error: 'Server configuration incomplete' }, { status: 500 })

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Resolve tenant
    const { data: ownedTenant } = await supabaseAdmin
        .from('tenants').select('id').eq('owner_id', user.id).limit(1).single()
    if (!ownedTenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const tenantId = ownedTenant.id

    const body = await request.json()
    const rows: ImportRow[] = body.rows || []

    if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }
    if (rows.length > 200) {
        return NextResponse.json({ error: 'Maximum 200 rows per import' }, { status: 400 })
    }

    const results: ImportResult[] = []

    for (const row of rows) {
        if (!row.email || !row.name) {
            results.push({ email: row.email || '', name: row.name || '', status: 'error', error: 'Nome e email obrigatórios' })
            continue
        }

        const tempPassword = generateTempPassword()

        try {
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: row.email.toLowerCase().trim(),
                password: tempPassword,
                email_confirm: true,
                user_metadata: { full_name: row.name.trim(), role: 'patient', tenant_id: tenantId },
            })

            if (authError || !authData.user) {
                results.push({ email: row.email, name: row.name, status: 'error', error: authError?.message || 'Erro ao criar usuário' })
                continue
            }

            const userId = authData.user.id

            const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
                user_id: userId,
                tenant_id: tenantId,
                name: row.name.trim(),
                email: row.email.toLowerCase().trim(),
                phone: row.phone?.trim() || null,
                role: 'patient',
                current_plan: row.plan || 'community',
                primary_goal: row.primary_goal?.trim() || null,
                nutri_coins: 100,
                total_xp: 0,
                current_level: 1,
            }, { onConflict: 'user_id' })

            if (profileError) {
                await supabaseAdmin.auth.admin.deleteUser(userId)
                results.push({ email: row.email, name: row.name, status: 'error', error: profileError.message })
                continue
            }

            await supabaseAdmin.from('subscriptions').insert({
                user_id: userId,
                tenant_id: tenantId,
                plan: row.plan || 'community',
                status: 'active',
                gateway: 'manual',
                updated_at: new Date().toISOString(),
            })

            results.push({ email: row.email, name: row.name, status: 'success', temp_password: tempPassword })
        } catch (err: any) {
            results.push({ email: row.email, name: row.name, status: 'error', error: err.message || 'Erro inesperado' })
        }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    return NextResponse.json({ results, summary: { total: rows.length, success: successCount, errors: errorCount } })
}
