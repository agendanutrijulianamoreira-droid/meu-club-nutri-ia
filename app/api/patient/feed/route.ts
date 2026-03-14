import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, name')
        .eq('user_id', user.id)
        .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')  // created_at for pagination
    const limit = 20

    // Fetch posts
    let q = supabase
        .from('community_posts')
        .select('id, type, body, meta, is_pinned, created_at, user_id')
        .eq('tenant_id', profile.tenant_id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)

    if (cursor) q = q.lt('created_at', cursor)

    const { data: posts, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!posts || posts.length === 0) {
        return NextResponse.json({ posts: [], hasMore: false })
    }

    const postIds = posts.map(p => p.id)
    const authorIds = Array.from(new Set(posts.map(p => p.user_id as string)))

    // Fetch authors
    const { data: authors } = await supabase
        .from('profiles')
        .select('user_id, name, current_streak, current_level')
        .in('user_id', authorIds)

    const authorMap: Record<string, any> = {}
    for (const a of authors || []) authorMap[a.user_id] = a

    // Fetch reactions per post
    const { data: reactions } = await supabase
        .from('community_reactions')
        .select('post_id, user_id, emoji')
        .in('post_id', postIds)

    // Group reactions
    const reactionsByPost: Record<string, { emoji: string; count: number; reacted: boolean }[]> = {}
    const emojiCountsByPost: Record<string, Record<string, { count: number; reacted: boolean }>> = {}

    for (const r of reactions || []) {
        if (!emojiCountsByPost[r.post_id]) emojiCountsByPost[r.post_id] = {}
        if (!emojiCountsByPost[r.post_id][r.emoji]) {
            emojiCountsByPost[r.post_id][r.emoji] = { count: 0, reacted: false }
        }
        emojiCountsByPost[r.post_id][r.emoji].count++
        if (r.user_id === user.id) emojiCountsByPost[r.post_id][r.emoji].reacted = true
    }

    for (const postId of postIds) {
        reactionsByPost[postId] = Object.entries(emojiCountsByPost[postId] || {}).map(([emoji, v]) => ({
            emoji,
            count: v.count,
            reacted: v.reacted,
        }))
    }

    // Assemble
    const enriched = posts.map(p => {
        const author = authorMap[p.user_id]
        const name = author?.name || 'Rainha'
        return {
            id: p.id,
            type: p.type,
            body: p.body,
            meta: p.meta,
            is_pinned: p.is_pinned,
            created_at: p.created_at,
            is_own: p.user_id === user.id,
            author: {
                name,
                initials: name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
                streak: author?.current_streak || 0,
                level: author?.current_level || 1,
            },
            reactions: reactionsByPost[p.id] || [],
        }
    })

    const hasMore = posts.length === limit
    const nextCursor = hasMore ? posts[posts.length - 1].created_at : null

    return NextResponse.json({ posts: enriched, hasMore, nextCursor })
}

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, name')
        .eq('user_id', user.id)
        .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const body = await request.json()
    const text = (body.body || '').trim()
    if (!text || text.length > 500) {
        return NextResponse.json({ error: 'Texto inválido (1-500 caracteres)' }, { status: 400 })
    }

    const { data: post, error } = await supabase
        .from('community_posts')
        .insert({
            tenant_id: profile.tenant_id,
            user_id: user.id,
            type: 'text',
            body: text,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ post })
}
