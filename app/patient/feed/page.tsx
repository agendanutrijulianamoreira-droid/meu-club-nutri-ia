"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Flame, Trophy, Star, Zap, Heart, Send, ChevronUp,
    Sparkles, Crown, Target, Loader2, Users, Lock, MessageSquare
} from "lucide-react"

const EMOJIS = ["🔥", "💜", "👏", "💪", "⭐", "🎉"]

type Reaction = { emoji: string; count: number; reacted: boolean }
type Post = {
    id: string
    type: string
    body: string
    meta: any
    is_pinned: boolean
    created_at: string
    is_own: boolean
    author: { name: string; initials: string; streak: number; level: number }
    reactions: Reaction[]
}

const TYPE_STYLES: Record<string, { bg: string; border: string; badge: string; icon: JSX.Element }> = {
    streak: {
        bg: "from-orange-950/60 to-rose-950/40",
        border: "border-orange-500/30",
        badge: "bg-orange-500/20 text-orange-300 border-orange-500/30",
        icon: <Flame size={14} className="text-orange-400" />,
    },
    victory: {
        bg: "from-indigo-950/60 to-violet-950/40",
        border: "border-indigo-500/30",
        badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        icon: <Trophy size={14} className="text-indigo-400" />,
    },
    checkin: {
        bg: "from-emerald-950/60 to-teal-950/40",
        border: "border-emerald-500/30",
        badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        icon: <Star size={14} className="text-emerald-400" />,
    },
    weight: {
        bg: "from-violet-950/60 to-purple-950/40",
        border: "border-violet-500/30",
        badge: "bg-violet-500/20 text-violet-300 border-violet-500/30",
        icon: <Target size={14} className="text-violet-400" />,
    },
    text: {
        bg: "from-slate-900/80 to-slate-900/60",
        border: "border-white/10",
        badge: "bg-white/10 text-slate-400 border-white/10",
        icon: <MessageSquare size={14} className="text-slate-400" />,
    },
    system: {
        bg: "from-amber-950/60 to-yellow-950/40",
        border: "border-amber-500/30",
        badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        icon: <Sparkles size={14} className="text-amber-400" />,
    },
}

const TYPE_LABELS: Record<string, string> = {
    streak: "Streak", victory: "Vitória", checkin: "Check-in",
    weight: "Meta", text: "Post", system: "Novidade",
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return "agora"
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
}

function Avatar({ initials, streak }: { initials: string; streak: number }) {
    const hasFire = streak >= 7
    return (
        <div className="relative flex-shrink-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white
                ${hasFire ? "bg-gradient-to-br from-orange-500 to-rose-600" : "bg-gradient-to-br from-indigo-600 to-violet-700"}`}>
                {initials}
            </div>
            {hasFire && (
                <div className="absolute -bottom-1 -right-1 bg-slate-950 rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                    🔥
                </div>
            )}
        </div>
    )
}

function PostCard({ post, onReact }: { post: Post; onReact: (postId: string, emoji: string) => unknown; key?: string }) {
    const [showEmojis, setShowEmojis] = useState(false)
    const style = TYPE_STYLES[post.type] || TYPE_STYLES.text

    const totalReactions = post.reactions.reduce((acc, r) => acc + r.count, 0)
    const topReaction = post.reactions.sort((a, b) => b.count - a.count)[0]

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-gradient-to-br ${style.bg} border ${style.border} rounded-3xl p-4 relative overflow-hidden`}
        >
            {post.is_pinned && (
                <div className="absolute top-3 right-3">
                    <Crown size={14} className="text-amber-400" />
                </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                <Avatar initials={post.author.initials} streak={post.author.streak} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">
                            {post.is_own ? "Você" : post.author.name.split(" ")[0]}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${style.badge}`}>
                            {style.icon} {TYPE_LABELS[post.type] || "Post"}
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{timeAgo(post.created_at)}</p>
                </div>
            </div>

            {/* Body */}
            <p className="text-sm text-slate-200 leading-relaxed mb-3 pl-0">{post.body}</p>

            {/* Meta badges */}
            {post.meta && Object.keys(post.meta).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {post.meta.streak_days && (
                        <span className="text-[11px] bg-orange-500/15 text-orange-300 border border-orange-500/20 px-2 py-0.5 rounded-full font-bold">
                            🔥 {post.meta.streak_days} dias
                        </span>
                    )}
                    {post.meta.xp_earned && (
                        <span className="text-[11px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
                            ⚡ +{post.meta.xp_earned} XP
                        </span>
                    )}
                    {post.meta.goal && (
                        <span className="text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                            ✅ {post.meta.goal}
                        </span>
                    )}
                </div>
            )}

            {/* Reactions */}
            <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                    {post.reactions.filter(r => r.count > 0).map(r => (
                        <button
                            key={r.emoji}
                            onClick={() => onReact(post.id, r.emoji)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold transition-all active:scale-95
                                ${r.reacted
                                    ? "bg-indigo-500/30 border border-indigo-400/50 text-white"
                                    : "bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10"
                                }`}
                        >
                            {r.emoji} <span>{r.count}</span>
                        </button>
                    ))}
                    {totalReactions === 0 && (
                        <span className="text-[11px] text-slate-700">Seja o primeiro a reagir</span>
                    )}
                </div>

                {/* Emoji picker trigger */}
                <div className="relative">
                    <button
                        onClick={() => setShowEmojis(!showEmojis)}
                        className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:bg-white/10 transition-all"
                    >
                        <span className="text-base">+</span>
                    </button>
                    <AnimatePresence>
                        {showEmojis && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: 8 }}
                                className="absolute bottom-10 right-0 bg-slate-900 border border-white/15 rounded-2xl p-2 flex gap-1 shadow-2xl z-20"
                            >
                                {EMOJIS.map(e => (
                                    <button
                                        key={e}
                                        onClick={() => { onReact(post.id, e); setShowEmojis(false) }}
                                        className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded-xl transition-all active:scale-90"
                                    >
                                        {e}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    )
}

function ComposerBox({ onPost }: { onPost: (text: string) => Promise<void> }) {
    const [text, setText] = useState("")
    const [loading, setLoading] = useState(false)
    const [focused, setFocused] = useState(false)
    const MAX = 500

    const handleSubmit = async () => {
        if (!text.trim() || loading) return
        setLoading(true)
        try {
            await onPost(text.trim())
            setText("")
        } finally {
            setLoading(false)
        }
    }

    const suggestions = [
        "Hoje foi difícil, mas não desisti 💪",
        "Bati a meta de água hoje! 💧",
        "Almoço on plan hoje 🥗",
        "7 dias de streak! 🔥",
    ]

    return (
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-4 mb-4">
            <div className={`bg-white/5 border rounded-2xl transition-all ${focused ? "border-indigo-500/50" : "border-white/10"}`}>
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value.slice(0, MAX))}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="Compartilhe uma vitória, dificuldade ou dica..."
                    className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none px-4 pt-3 pb-2 rounded-2xl focus:outline-none min-h-[72px]"
                    rows={3}
                />
                <div className="flex items-center justify-between px-4 pb-3">
                    <span className={`text-[10px] font-bold ${text.length > MAX * 0.9 ? "text-rose-400" : "text-slate-700"}`}>
                        {text.length}/{MAX}
                    </span>
                    <button
                        onClick={handleSubmit}
                        disabled={!text.trim() || loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all active:scale-95"
                    >
                        {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        Postar
                    </button>
                </div>
            </div>

            {/* Quick suggestions */}
            {!text && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {suggestions.map(s => (
                        <button
                            key={s}
                            onClick={() => setText(s)}
                            className="text-[11px] bg-white/5 border border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20 px-2.5 py-1 rounded-xl transition-all"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function FeedPage() {
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<"feed" | "ranking">("feed")
    const [ranking, setRanking] = useState<any[]>([])
    const [rankLoading, setRankLoading] = useState(false)
    const [myUserId, setMyUserId] = useState<string | null>(null)
    const loaderRef = useRef<HTMLDivElement>(null)

    const loadFeed = useCallback(async (cursor?: string) => {
        const url = `/api/patient/feed${cursor ? `?cursor=${cursor}` : ""}`
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        if (cursor) {
            setPosts(prev => [...prev, ...data.posts])
        } else {
            setPosts(data.posts || [])
        }
        setHasMore(data.hasMore)
        setNextCursor(data.nextCursor)
    }, [])

    const loadRanking = useCallback(async () => {
        setRankLoading(true)
        try {
            const res = await fetch("/api/patient/ranking")
            if (res.ok) {
                const data = await res.json()
                setRanking(data.ranking || [])
                setMyUserId(data.myUserId)
            }
        } finally {
            setRankLoading(false)
        }
    }, [])

    useEffect(() => {
        loadFeed().finally(() => setLoading(false))
    }, [loadFeed])

    useEffect(() => {
        if (activeTab === "ranking" && ranking.length === 0) loadRanking()
    }, [activeTab, ranking.length, loadRanking])

    // Infinite scroll
    useEffect(() => {
        if (!loaderRef.current || !hasMore) return
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !loadingMore) {
                setLoadingMore(true)
                loadFeed(nextCursor || undefined).finally(() => setLoadingMore(false))
            }
        }, { threshold: 0.1 })
        observer.observe(loaderRef.current)
        return () => observer.disconnect()
    }, [hasMore, nextCursor, loadFeed, loadingMore])

    const handlePost = async (text: string) => {
        const res = await fetch("/api/patient/feed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: text }),
        })
        if (res.ok) {
            await loadFeed()  // refresh
        }
    }

    const handleReact = async (postId: string, emoji: string) => {
        // Optimistic update
        setPosts(prev => prev.map(p => {
            if (p.id !== postId) return p
            const existing = p.reactions.find(r => r.emoji === emoji)
            if (existing) {
                if (existing.reacted) {
                    return {
                        ...p, reactions: p.reactions.map(r =>
                            r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r
                        ).filter(r => r.count > 0)
                    }
                } else {
                    return {
                        ...p, reactions: p.reactions.map(r =>
                            r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r
                        )
                    }
                }
            } else {
                return { ...p, reactions: [...p.reactions, { emoji, count: 1, reacted: true }] }
            }
        }))

        await fetch(`/api/patient/feed/${postId}/react`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emoji }),
        })
    }

    return (
        <div className="min-h-screen pb-28">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 pt-6 pb-3">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users size={20} className="text-indigo-400" />
                            Comunidade
                        </h1>
                        <p className="text-[11px] text-slate-600 mt-0.5">Sua tribo de rainhas 👑</p>
                    </div>
                </div>
                {/* Tabs */}
                <div className="flex gap-1 bg-white/5 rounded-2xl p-1">
                    {(["feed", "ranking"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all
                                ${activeTab === tab
                                    ? "bg-indigo-600 text-white shadow"
                                    : "text-slate-500 hover:text-slate-300"}`}
                        >
                            {tab === "feed" ? "🏡 Feed" : "🏆 Ranking"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 pt-4 max-w-lg mx-auto">
                <AnimatePresence mode="wait">
                    {activeTab === "feed" && (
                        <motion.div
                            key="feed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <ComposerBox onPost={handlePost} />

                            {loading ? (
                                <div className="flex justify-center py-16">
                                    <Loader2 className="animate-spin text-slate-600" size={28} />
                                </div>
                            ) : posts.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="text-5xl mb-4">🌱</div>
                                    <p className="text-white font-bold mb-2">O feed está vazio</p>
                                    <p className="text-slate-500 text-sm">Seja a primeira a postar uma vitória!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {posts.map((post: Post) => {
                                        return <PostCard key={post.id} post={post} onReact={handleReact} />
                                    })}
                                    <div ref={loaderRef} className="py-4 flex justify-center">
                                        {loadingMore && <Loader2 className="animate-spin text-slate-700" size={20} />}
                                        {!hasMore && posts.length > 0 && (
                                            <p className="text-[11px] text-slate-700">Você chegou ao início do feed</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === "ranking" && (
                        <motion.div
                            key="ranking"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {rankLoading ? (
                                <div className="flex justify-center py-16">
                                    <Loader2 className="animate-spin text-slate-600" size={28} />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Podium top 3 */}
                                    {ranking.slice(0, 3).length > 0 && (
                                        <div className="bg-gradient-to-br from-amber-950/40 to-yellow-950/20 border border-amber-500/20 rounded-3xl p-4 mb-4">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-4 flex items-center gap-1">
                                                <Crown size={12} /> Pódio desta semana
                                            </p>
                                            <div className="flex items-end justify-center gap-3">
                                                {[ranking[1], ranking[0], ranking[2]].map((p, i) => {
                                                    if (!p) return <div key={i} className="w-20" />
                                                    const isFirst = p.rank === 1
                                                    return (
                                                        <div key={p.user_id} className={`flex flex-col items-center ${isFirst ? "scale-110" : ""}`}>
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white mb-1
                                                                ${isFirst ? "bg-gradient-to-br from-yellow-500 to-orange-500" :
                                                                    p.rank === 2 ? "bg-gradient-to-br from-slate-400 to-slate-500" :
                                                                        "bg-gradient-to-br from-orange-700 to-orange-800"}`}>
                                                                {(p.name || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 font-bold truncate max-w-[60px] text-center">
                                                                {p.name?.split(' ')[0]}
                                                            </span>
                                                            <span className="text-[10px] text-indigo-400 font-black">
                                                                {(p.total_xp || 0).toLocaleString('pt-BR')} XP
                                                            </span>
                                                            <span className="text-base mt-0.5">
                                                                {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉"}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Full list */}
                                    {ranking.map((p) => (
                                        <div
                                            key={p.user_id}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all
                                                ${p.user_id === myUserId
                                                    ? "bg-indigo-500/10 border-indigo-500/30"
                                                    : "bg-white/[0.03] border-white/5"
                                                }`}
                                        >
                                            <span className={`w-7 text-center text-sm font-black
                                                ${p.rank === 1 ? "text-yellow-400" :
                                                    p.rank === 2 ? "text-slate-400" :
                                                        p.rank === 3 ? "text-orange-600" : "text-slate-600"}`}>
                                                {p.rank}
                                            </span>
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0
                                                ${p.current_streak >= 7 ? "bg-gradient-to-br from-orange-500 to-rose-600" : "bg-gradient-to-br from-indigo-600 to-violet-700"}`}>
                                                {(p.name || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">
                                                    {p.user_id === myUserId ? "Você" : p.name?.split(' ')[0]}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-orange-400">🔥 {p.current_streak}d</span>
                                                    <span className="text-[10px] text-slate-600">·</span>
                                                    <span className="text-[10px] text-indigo-400">⚡ {(p.total_xp || 0).toLocaleString('pt-BR')} XP</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
