import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const postId = params.id
    const body = await request.json()
    const emoji = body.emoji || '🔥'

    // Check if already reacted with this emoji
    const { data: existing } = await supabase
        .from('community_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single()

    if (existing) {
        // Toggle off
        await supabase.from('community_reactions').delete().eq('id', existing.id)
        return NextResponse.json({ action: 'removed' })
    } else {
        // Add reaction (upsert handles race condition)
        await supabase.from('community_reactions').upsert({
            post_id: postId,
            user_id: user.id,
            emoji,
        })
        return NextResponse.json({ action: 'added' })
    }
}
