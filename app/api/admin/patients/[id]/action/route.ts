import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendWhatsApp } from '@/lib/services/whatsapp'
import { OnboardingService } from '@/lib/services/onboarding'

// POST /api/admin/patients/[id]/action
// actions: assign-protocol | send-message | send-rescue | send-congrats | update-restrictions | update-plan | send-credentials
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id, brand_name, method_name, gpt_system_prompt, settings')
        .eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const patientId = params.id
    const body = await request.json()
    const { action } = body

    // Verify patient belongs to tenant
    const { data: profile } = await supabase
        .from('profiles').select('name, email, phone, tenant_id, current_streak, last_checkin_date')
        .eq('user_id', patientId).single()
    if (!profile || profile.tenant_id !== tenant.id) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // ── Assign protocol ──────────────────────────────────────────────────────
    if (action === 'assign-protocol') {
        const { protocol_id } = body
        if (!protocol_id) return NextResponse.json({ error: 'protocol_id required' }, { status: 400 })

        // Cancel current active assignment
        await supabase.from('protocol_assignments')
            .update({ status: 'cancelled' })
            .eq('user_id', patientId)
            .eq('status', 'active')

        // Create new assignment
        const { data, error } = await supabase.from('protocol_assignments').insert({
            user_id: patientId,
            protocol_id,
            start_date: new Date().toISOString().split('T')[0],
            status: 'active',
        }).select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Notify patient
        const { data: proto } = await supabase.from('protocols').select('title').eq('id', protocol_id).single()
        await supabase.from('notifications').insert({
            tenant_id: tenant.id,
            user_id: patientId,
            title: '🎯 Novo protocolo atribuído!',
            body: `Você recebeu o protocolo "${proto?.title || 'Novo Protocolo'}". Comece hoje!`,
            cta_label: 'Ver protocolo',
            cta_url: '/patient/diet',
            status: 'unread',
        })

        return NextResponse.json({ success: true, assignment: data })
    }

    // ── Remove protocol assignment ───────────────────────────────────────────
    if (action === 'remove-protocol') {
        await supabase.from('protocol_assignments')
            .update({ status: 'cancelled' })
            .eq('user_id', patientId)
            .eq('status', 'active')
        return NextResponse.json({ success: true })
    }

    // ── Send rescue message ──────────────────────────────────────────────────
    if (action === 'send-rescue') {
        const firstName = profile.name?.split(' ')[0] || 'Rainha'
        const daysSince = profile.last_checkin_date
            ? Math.floor((Date.now() - new Date(profile.last_checkin_date).getTime()) / 86400000)
            : 999

        let title = `${firstName}, sentimos sua falta 💜`
        let msgBody = `Faz ${daysSince > 999 ? 'um tempo' : daysSince + ' dias'} que você não aparece. Que tal dar um pequeno passo hoje? Estamos aqui por você. 🌿`

        try {
            const tone = tenant.settings?.ai?.tone || 'motivadora'
            const prompt = `Você é a IA do ${tenant.brand_name}. 
Escreva uma mensagem de RESGATE para ${firstName} que está inativa há ${daysSince === 999 ? 'muito tempo' : daysSince + ' dias'}.
Tom: ${tone === 'acolhedora' ? 'carinhoso e acolhedor' : tone === 'tecnica' ? 'direto e objetivo' : 'motivacional e energético'}.
Sem julgamento. Máximo 2 frases. Termine com emoji.
Retorne JSON: {"title": "...", "body": "..."}`

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 200, responseMimeType: 'application/json' },
                })
            })
            if (res.ok) {
                const data = await res.json()
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
                const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
                const parsed = JSON.parse(clean)
                if (parsed.title) title = parsed.title
                if (parsed.body) msgBody = parsed.body
            }
        } catch { /* use fallback */ }

        // Write to inbox_messages (new) and notifications (legacy) for backward compatibility
        await supabase.from('inbox_messages').insert({
            tenant_id: tenant.id, user_id: patientId,
            agent_name: 'manual', title, body: msgBody,
            message_type: 'rescue', priority: 'high',
            cta_label: 'Voltar ao app', cta_url: '/patient/home',
            channels: ['inbox', 'push'],
        })

        return NextResponse.json({ success: true, title, body: msgBody })
    }

    // ── Send congrats message ─────────────────────────────────────────────────
    if (action === 'send-congrats') {
        const firstName = profile.name?.split(' ')[0] || 'Rainha'
        const streak = profile.current_streak || 0

        await supabase.from('inbox_messages').insert({
            tenant_id: tenant.id, user_id: patientId,
            agent_name: 'manual',
            title: `${firstName}, você é incrível! 🏆`,
            body: `${streak > 0 ? `${streak} dias de streak e` : ''} uma consistência que inspira todo o clube! Continue assim, rainha! 👑`,
            message_type: 'celebration', priority: 'normal',
            cta_label: 'Ver conquistas', cta_url: '/patient/home',
            channels: ['inbox'],
        })

        return NextResponse.json({ success: true })
    }

    // ── Send custom message ───────────────────────────────────────────────────
    if (action === 'send-message') {
        const { title: msgTitle, body: msgBody } = body
        if (!msgTitle || !msgBody) return NextResponse.json({ error: 'title and body required' }, { status: 400 })

        await supabase.from('inbox_messages').insert({
            tenant_id: tenant.id, user_id: patientId,
            agent_name: 'manual',
            title: msgTitle, body: msgBody,
            message_type: 'engagement', priority: 'normal',
            channels: ['inbox'],
        })

        return NextResponse.json({ success: true })
    }

    // ── Update dietary restrictions ───────────────────────────────────────────
    if (action === 'update-restrictions') {
        const { restrictions } = body // string[]
        if (!Array.isArray(restrictions)) return NextResponse.json({ error: 'restrictions must be array' }, { status: 400 })

        await supabase.from('profiles')
            .update({ dietary_restrictions: restrictions })
            .eq('user_id', patientId)
            .eq('tenant_id', tenant.id)

        return NextResponse.json({ success: true })
    }

    // ── Update plan ───────────────────────────────────────────────────────────
    if (action === 'update-plan') {
        const { plan } = body
        if (!plan) return NextResponse.json({ error: 'plan required' }, { status: 400 })

        await supabase.from('profiles')
            .update({ current_plan: plan })
            .eq('user_id', patientId)
            .eq('tenant_id', tenant.id)

        return NextResponse.json({ success: true })
    }

    // ── Update profile fields ─────────────────────────────────────────────────
    if (action === 'update-profile') {
        const { name, phone, current_plan, current_weight, primary_goal } = body
        const updates: Record<string, unknown> = {}
        if (name !== undefined && name !== '') updates.name = name
        if (phone !== undefined) updates.phone = phone
        if (current_plan !== undefined && current_plan !== '') updates.current_plan = current_plan
        if (current_weight !== undefined && current_weight !== '') updates.current_weight = parseFloat(current_weight)
        if (primary_goal !== undefined) updates.primary_goal = primary_goal

        if (Object.keys(updates).length === 0) return NextResponse.json({ success: true })

        const { error } = await supabase.from('profiles')
            .update(updates)
            .eq('user_id', patientId)
            .eq('tenant_id', tenant.id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ success: true })
    }

    // ── Send credentials (magic link) ────────────────────────────────────────
    if (action === 'send-credentials') {
        if (!profile.email) return NextResponse.json({ error: 'Paciente sem e-mail cadastrado' }, { status: 400 })

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 })

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Generate a password-reset link valid for 24h
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: profile.email,
        })

        if (linkError || !linkData?.properties?.action_link) {
            console.error('[send-credentials]', linkError)
            return NextResponse.json({ error: 'Erro ao gerar link de acesso' }, { status: 500 })
        }

        const accessLink = linkData.properties.action_link
        const firstName = profile.name?.split(' ')[0] || 'Rainha'
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://vitaclub.app'}/login`

        // Send email via Resend (best-effort)
        const emailSent = await OnboardingService.sendCredentialsEmail(
            profile.email,
            profile.name || 'Paciente',
            tenant.brand_name,
            accessLink
        ).catch(() => false)

        // Send to patient inbox so she sees it on first login
        await supabase.from('inbox_messages').insert({
            tenant_id: tenant.id,
            user_id: patientId,
            agent_name: 'sistema',
            title: `🔑 Seus dados de acesso – ${tenant.brand_name}`,
            body: `Olá, ${firstName}! Seu acesso ao ${tenant.brand_name} está pronto.\n\nE-mail: ${profile.email}\n\nClique no botão abaixo para definir sua senha e entrar na plataforma. O link expira em 24 horas.`,
            message_type: 'system',
            priority: 'high',
            status: 'unread',
            cta_label: 'Definir minha senha',
            cta_url: accessLink,
            channels: ['inbox'],
        })

        // Best-effort: WhatsApp via Evolution API (non-blocking)
        if (profile.phone) {
            const msg = `Olá, ${firstName}! 👋\n\nSeu acesso ao *${tenant.brand_name}* está pronto.\n\n📧 E-mail: ${profile.email}\n🔑 Defina sua senha: ${accessLink}\n\nO link expira em 24 horas. Qualquer dúvida, estamos aqui! 💜`
            sendWhatsApp(profile.phone, msg).catch(() => { /* non-critical */ })
        }

        return NextResponse.json({ success: true, email: profile.email, email_sent: emailSent })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
