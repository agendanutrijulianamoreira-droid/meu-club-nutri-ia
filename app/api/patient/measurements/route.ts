import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('patient_id', user.id)
        .order('measured_at', { ascending: false })
        .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ measurements: data })
}

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()

    if (!profile?.tenant_id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const body = await request.json()
    const { weight_kg, waist_cm, hip_cm, arm_cm, thigh_cm, abdomen_cm, chest_cm, notes, measured_at } = body

    const { data, error } = await supabase
        .from('body_measurements')
        .insert({
            patient_id: user.id,
            tenant_id: profile.tenant_id,
            weight_kg: weight_kg || null,
            waist_cm: waist_cm || null,
            hip_cm: hip_cm || null,
            arm_cm: arm_cm || null,
            thigh_cm: thigh_cm || null,
            abdomen_cm: abdomen_cm || null,
            chest_cm: chest_cm || null,
            notes: notes || null,
            measured_at: measured_at || new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

    if (error) {
        console.error('[measurements POST]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update current_weight on profile if weight provided
    if (weight_kg) {
        await supabase
            .from('profiles')
            .update({ current_weight: weight_kg })
            .eq('user_id', user.id)
    }

    return NextResponse.json({ measurement: data }, { status: 201 })
}
