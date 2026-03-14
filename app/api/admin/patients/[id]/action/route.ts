import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// POST /api/admin/patients/[id]/action
// actions: assign-protocol | send-message | send-rescue | send-congrats
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
        .from('profiles').select('name, tenant_id, current_streak, last_checkin_date')
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
            .eq('tenant_id', tenant.id)
            .eq('status', 'active')

        // Create new assignment
        const { data, error } = await supabase.from('protocol_assignments').insert({
            user_id: patientId,
            protocol_id,
            tenant_id: tenant.id,
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
            .eq('tenant_id', tenant.id)
            .eq('status', 'active')
        return NextResponse.json({ success: true })
    }

    // ── Send rescue message ──────────────────────────────────────────────────
    if (action === 'send-rescue') {
        const firstName = profile.name?.split(' ')[0] || 'Rainha'
        const daysSince = profile.last_checkin_date
            ? Math.floor((Date.now() - new Date(profile.last_checkin_date).getTime()) / 86400000)
            : 999

        const GEMINI_KEY = process.env.GEMINI_API_KEY!
        let title = `${firstName}, sentimos sua falta 💜`
        let msgBody = `Faz ${daysSince > 999 ? 'um tempo' : daysSince + ' dias'} que você não aparece. Que tal dar um pequeno passo hoje? Estamos aqui por você. 🌿`

        try {
            const tone = tenant.settings?.ai?.tone || 'motivadora'
            const prompt = `Você é a IA do ${tenant.brand_name}. 
Escreva uma mensagem de RESGATE para ${firstName} que está inativa há ${daysSince === 999 ? 'muito tempo' : daysSince + ' dias'}.
Tom: ${tone === 'acolhedora' ? 'carinhoso e acolhedor' : tone === 'tecnica' ? 'direto e objetivo' : 'motivacional e energético'}.
Sem julgamento. Máximo 2 frases. Termine com emoji.
Retorne JSON: {"title": "...", "body": "..."}`

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 150 }
                })
            })
            if (res.ok) {
                const data = await res.json()
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
                const parsed = JSON.parse(text)
                if (parsed.title) title = parsed.title
                if (parsed.body) msgBody = parsed.body
            }
        } catch { /* use fallback */ }

        await supabase.from('notifications').insert({
            tenant_id: tenant.id, user_id: patientId,
            title, body: msgBody,
            cta_label: 'Voltar ao app', cta_url: '/patient/home',
            status: 'unread',
        })

        return NextResponse.json({ success: true, title, body: msgBody })
    }

    // ── Send congrats message ─────────────────────────────────────────────────
    if (action === 'send-congrats') {
        const firstName = profile.name?.split(' ')[0] || 'Rainha'
        const streak = profile.current_streak || 0

        await supabase.from('notifications').insert({
            tenant_id: tenant.id, user_id: patientId,
            title: `${firstName}, você é incrível! 🏆`,
            body: `${streak > 0 ? `${streak} dias de streak e` : ''} uma consistência que inspira todo o clube! Continue assim, rainha! 👑`,
            cta_label: 'Ver conquistas', cta_url: '/patient/home',
            status: 'unread',
        })

        return NextResponse.json({ success: true })
    }

    // ── Send custom message ───────────────────────────────────────────────────
    if (action === 'send-message') {
        const { title: msgTitle, body: msgBody } = body
        if (!msgTitle || !msgBody) return NextResponse.json({ error: 'title and body required' }, { status: 400 })

        await supabase.from('notifications').insert({
            tenant_id: tenant.id, user_id: patientId,
            title: msgTitle, body: msgBody,
            status: 'unread',
        })

        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
