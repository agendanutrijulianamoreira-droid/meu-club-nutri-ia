import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()
    if (!me) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')
    const challengeId = searchParams.get('challenge_id')

    // Return active challenges list for selection
    if (mode === 'challenges') {
        const today = new Date().toISOString().split('T')[0]
        const { data: challenges } = await supabase
            .from('challenges')
            .select('id, title, emoji, start_date, end_date, duration_days')
            .eq('tenant_id', me.tenant_id)
            .eq('is_active', true)
            .lte('start_date', today)
            .order('start_date', { ascending: false })
            .limit(10)
        return NextResponse.json({ challenges: challenges ?? [] })
    }

    // Challenge-specific ranking with tiebreakers
    if (challengeId) {
        const { data: challenge } = await supabase
            .from('challenges')
            .select('id, title, emoji, start_date, end_date')
            .eq('id', challengeId)
            .eq('tenant_id', me.tenant_id)
            .single()
        if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

        const today = new Date().toISOString().split('T')[0]
        const periodEnd = challenge.end_date && challenge.end_date < today ? challenge.end_date : today

        const { data: participants } = await supabase
            .from('challenge_participants')
            .select('user_id, score, status, joined_at')
            .eq('challenge_id', challengeId)
            .eq('tenant_id', me.tenant_id)

        if (!participants || participants.length === 0) {
            return NextResponse.json({ ranking: [], challenge, myUserId: user.id })
        }

        const userIds = participants.map((p: { user_id: string }) => p.user_id)

        const [profilesRes, habitLogsRes, postsRes, reactionsRes] = await Promise.all([
            supabase
                .from('profiles')
                .select('user_id, name, current_streak, current_level')
                .in('user_id', userIds),

            supabase
                .from('habit_logs')
                .select('user_id, hit_type')
                .in('user_id', userIds)
                .gte('log_date', challenge.start_date)
                .lte('log_date', periodEnd),

            supabase
                .from('community_posts')
                .select('user_id')
                .in('user_id', userIds)
                .gte('created_at', `${challenge.start_date}T00:00:00`)
                .lte('created_at', `${periodEnd}T23:59:59`),

            supabase
                .from('community_reactions')
                .select('user_id')
                .in('user_id', userIds)
                .gte('created_at', `${challenge.start_date}T00:00:00`)
                .lte('created_at', `${periodEnd}T23:59:59`),
        ])

        const profileMap: Record<string, { name: string; current_streak: number; current_level: number }> = {}
        for (const p of profilesRes.data ?? []) {
            profileMap[p.user_id] = p
        }

        const hitMap: Record<string, { camera: number; gallery: number; simple: number }> = {}
        for (const log of habitLogsRes.data ?? []) {
            if (!hitMap[log.user_id]) hitMap[log.user_id] = { camera: 0, gallery: 0, simple: 0 }
            if (log.hit_type === 'camera') hitMap[log.user_id].camera++
            else if (log.hit_type === 'gallery') hitMap[log.user_id].gallery++
            else hitMap[log.user_id].simple++
        }

        const engagementMap: Record<string, number> = {}
        for (const post of postsRes.data ?? []) {
            engagementMap[post.user_id] = (engagementMap[post.user_id] || 0) + 1
        }
        for (const reaction of reactionsRes.data ?? []) {
            engagementMap[reaction.user_id] = (engagementMap[reaction.user_id] || 0) + 1
        }

        const ranking = participants
            .map((p: { user_id: string; score: number; status: string; joined_at: string }) => {
                const profile = profileMap[p.user_id] || { name: 'Participante', current_streak: 0, current_level: 1 }
                const hits = hitMap[p.user_id] || { camera: 0, gallery: 0, simple: 0 }
                const engagement = engagementMap[p.user_id] || 0
                return {
                    user_id: p.user_id,
                    name: profile.name,
                    current_streak: profile.current_streak,
                    current_level: profile.current_level,
                    score: p.score || 0,
                    status: p.status,
                    camera_hits: hits.camera,
                    gallery_hits: hits.gallery,
                    simple_hits: hits.simple,
                    engagement,
                }
            })
            .sort((a: { score: number; camera_hits: number; gallery_hits: number; engagement: number },
                   b: { score: number; camera_hits: number; gallery_hits: number; engagement: number }) => {
                if (b.score !== a.score) return b.score - a.score
                if (b.camera_hits !== a.camera_hits) return b.camera_hits - a.camera_hits
                if (b.gallery_hits !== a.gallery_hits) return b.gallery_hits - a.gallery_hits
                return b.engagement - a.engagement
            })
            .map((p: { user_id: string; name: string; current_streak: number; current_level: number; score: number; status: string; camera_hits: number; gallery_hits: number; simple_hits: number; engagement: number }, i: number) => ({ ...p, rank: i + 1 }))

        return NextResponse.json({ ranking, challenge, myUserId: user.id })
    }

    // Global XP ranking (default)
    const { data: patients } = await supabase
        .from('profiles')
        .select('user_id, name, total_xp, current_streak, current_level')
        .eq('tenant_id', me.tenant_id)
        .eq('role', 'patient')
        .order('total_xp', { ascending: false })
        .limit(50)

    const ranking = (patients || []).map((p, i) => ({ ...p, rank: i + 1 }))
    return NextResponse.json({ ranking, myUserId: user.id })
}
