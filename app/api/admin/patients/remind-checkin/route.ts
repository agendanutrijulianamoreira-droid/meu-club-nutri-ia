import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// POST /api/admin/patients/remind-checkin
// Sends a check-in reminder to all patients who haven't submitted a weekly check-in this week
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants')
        .select('id, brand_name, settings')
        .eq('owner_id', user.id)
        .single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Get Monday of current week (week_start)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`

    // Get all patients for this tenant
    const { data: patients } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('tenant_id', tenant.id)
        .eq('role', 'patient')

    if (!patients || patients.length === 0) {
        return NextResponse.json({ sent: 0, message: 'Nenhuma paciente encontrada' })
    }

    // Get IDs of patients who already checked in this week
    const patientIds = patients.map(p => p.user_id)
    const { data: checkins } = await supabase
        .from('weekly_checkin_responses')
        .select('user_id')
        .eq('tenant_id', tenant.id)
        .eq('week_start', weekStart)
        .in('user_id', patientIds)

    const checkedInIds = new Set((checkins || []).map((c: { user_id: string }) => c.user_id))
    const pendingPatients = patients.filter(p => !checkedInIds.has(p.user_id))

    if (pendingPatients.length === 0) {
        return NextResponse.json({ sent: 0, message: 'Todas as pacientes já fizeram check-in esta semana!' })
    }

    // Generate AI message (single shared message for efficiency)
    const brandName = tenant.brand_name || 'o clube'
    const tone = tenant.settings?.ai?.tone || 'motivadora'
    let title = '🌟 Seu check-in semanal está esperando!'
    let body = `Só 2 minutinhos para registrar sua semana e ganhar +20 XP. Conta tudo para a gente! 💪`

    try {
        const prompt = `Você é a IA do ${brandName}.
Escreva uma mensagem CURTA e MOTIVACIONAL para pacientes que ainda não fizeram o check-in semanal.
Tom: ${tone === 'acolhedora' ? 'carinhoso e acolhedor' : tone === 'tecnica' ? 'direto e prático' : 'motivacional e energético'}.
Máximo 2 frases. Mencione que ganha XP. Termine com emoji.
Retorne JSON: {"title": "...", "body": "..."}`

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 150, responseMimeType: 'application/json' },
                }),
            }
        )
        if (res.ok) {
            const data = await res.json()
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
            const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
            const parsed = JSON.parse(clean)
            if (parsed.title) title = parsed.title
            if (parsed.body) body = parsed.body
        }
    } catch { /* use fallback */ }

    // Insert inbox messages for all pending patients in batch
    const messages = pendingPatients.map(p => ({
        tenant_id: tenant.id,
        user_id: p.user_id,
        agent_name: 'manual',
        title: title.replace('[nome]', p.name?.split(' ')[0] || 'Rainha'),
        body,
        message_type: 'engagement',
        priority: 'normal',
        cta_label: 'Fazer check-in agora',
        cta_url: '/patient/checkin',
        channels: ['inbox'],
        status: 'unread',
    }))

    const { error } = await supabase.from('inbox_messages').insert(messages)
    if (error) {
        console.error('[remind-checkin]', error)
        return NextResponse.json({ error: 'Erro ao enviar lembretes' }, { status: 500 })
    }

    return NextResponse.json({
        sent: pendingPatients.length,
        total: patients.length,
        message: `Lembrete enviado para ${pendingPatients.length} paciente(s)`,
    })
}
