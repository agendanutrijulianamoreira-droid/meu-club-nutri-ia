"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Users, Send, Pin, Trash2, Loader2, Sparkles,
    MessageSquare, Flame, Trophy, RefreshCw,
    Crown, AlertCircle, Eye, EyeOff, Lock, ShieldCheck
} from "lucide-react"

const TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
    text: { label: "Post", emoji: "💬", color: "text-slate-400" },
    victory: { label: "Vitória", emoji: "✅", color: "text-emerald-400" },
    streak: { label: "Streak", emoji: "🔥", color: "text-orange-400" },
    checkin: { label: "Check-in", emoji: "⭐", color: "text-indigo-400" },
    system: { label: "Anúncio", emoji: "📢", color: "text-amber-400" },
    weight: { label: "Meta", emoji: "🎯", color: "text-violet-400" },
}

const NIVEL_OPTIONS = [
    { value: 1, label: "Básico", desc: "Todos os membros", color: "text-slate-300", bg: "bg-slate-500/20 border-slate-500/30" },
    { value: 2, label: "Plus", desc: "Membros Plus e acima", color: "text-indigo-300", bg: "bg-indigo-500/20 border-indigo-500/30" },
    { value: 3, label: "VIP", desc: "Somente membros VIP", color: "text-amber-300", bg: "bg-amber-500/20 border-amber-500/30" },
    { value: 4, label: "Consulta", desc: "Clientes de consulta", color: "text-violet-300", bg: "bg-violet-500/20 border-violet-500/30" },
]

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return "agora"
    if (m < 60) return `${m}m atrás`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h atrás`
    return `${Math.floor(h / 24)}d atrás`
}

export function CommunityView() {
    const [posts, setPosts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [posting, setPosting] = useState(false)
    const [text, setText] = useState("")
    const [postType, setPostType] = useState<"system" | "victory">("system")
    const [pinPost, setPinPost] = useState(false)
    const [nivelMinimo, setNivelMinimo] = useState(1)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
    const [stats, setStats] = useState({ total: 0, today: 0, reactions: 0, types: {} as Record<string, number> })
    const [activeTab, setActiveTab] = useState<"publicar" | "moderacao">("publicar")
    const [comentarios, setComentarios] = useState<any[]>([])
    const [loadingComentarios, setLoadingComentarios] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 3000)
    }

    const loadPosts = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/community")
            if (res.ok) {
                const data = await res.json()
                const p = data.posts || []
                setPosts(p)
                const today = new Date().toDateString()
                const todayPosts = p.filter((x: any) => new Date(x.created_at).toDateString() === today).length
                const totalReactions = p.reduce((acc: number, x: any) => acc + (x.reaction_count || 0), 0)
                const types: Record<string, number> = {}
                for (const x of p) types[x.type] = (types[x.type] || 0) + 1
                setStats({ total: p.length, today: todayPosts, reactions: totalReactions, types })
            }
        } finally {
            setLoading(false)
        }
    }, [])

    const loadComentarios = useCallback(async () => {
        setLoadingComentarios(true)
        try {
            const res = await fetch("/api/admin/comunidade/comentarios")
            if (res.ok) {
                const data = await res.json()
                setComentarios(data.comentarios || [])
            }
        } finally {
            setLoadingComentarios(false)
        }
    }, [])

    useEffect(() => { loadPosts() }, [loadPosts])

    useEffect(() => {
        if (activeTab === "moderacao") loadComentarios()
    }, [activeTab, loadComentarios])

    const handlePost = async () => {
        if (!text.trim() || posting) return
        setPosting(true)
        try {
            const res = await fetch("/api/admin/community", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    body: text.trim(),
                    type: postType,
                    is_pinned: pinPost,
                    nivel_minimo: nivelMinimo,
                }),
            })
            if (res.ok) {
                setText("")
                setPinPost(false)
                setNivelMinimo(1)
                showToast('success', 'Post publicado!')
                await loadPosts()
            }
        } finally {
            setPosting(false)
        }
    }

    const handlePin = async (postId: string) => {
        await fetch("/api/admin/community", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "pin", post_id: postId }),
        })
        await loadPosts()
    }

    const handleToggleOculto = async (postId: string) => {
        const res = await fetch("/api/admin/community", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "toggle_oculto", post_id: postId }),
        })
        if (res.ok) {
            const d = await res.json()
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, oculto: d.oculto } : p))
        }
    }

    const handleDelete = async (postId: string) => {
        await fetch("/api/admin/community", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", post_id: postId }),
        })
        setConfirmDelete(null)
        await loadPosts()
    }

    const handleToggleComentario = async (id: string) => {
        const res = await fetch(`/api/admin/comunidade/comentarios/${id}`, { method: "PATCH" })
        if (res.ok) {
            const d = await res.json()
            setComentarios(prev => prev.map(c => c.id === id ? { ...c, oculto: d.oculto } : c))
        }
    }

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">
                        Comu<span className="font-bold">nidade</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gestão do feed social do clube</p>
                </div>
                <button onClick={loadPosts} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-slate-300 transition-all">
                    <RefreshCw size={16} />
                </button>
            </div>

            {toast && (
                <div className={`px-4 py-3 rounded-2xl text-sm font-bold border ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Posts total", value: stats.total, icon: <MessageSquare size={16} className="text-indigo-400" /> },
                    { label: "Hoje", value: stats.today, icon: <Sparkles size={16} className="text-violet-400" /> },
                    { label: "Reações", value: stats.reactions, icon: <Flame size={16} className="text-orange-400" /> },
                    { label: "Vitórias auto", value: stats.types["victory"] || 0, icon: <Trophy size={16} className="text-emerald-400" /> },
                ].map(s => (
                    <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">{s.icon}</div>
                        <p className="text-2xl font-bold text-white">{s.value}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1 w-fit">
                {(["publicar", "moderacao"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all
                            ${activeTab === tab
                                ? "bg-indigo-600 text-white shadow"
                                : "text-slate-500 hover:text-slate-300"}`}
                    >
                        {tab === "publicar" ? "✍️ Publicar" : "🛡️ Moderação"}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {activeTab === "publicar" && (
                    <motion.div
                        key="publicar"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-1 lg:grid-cols-5 gap-6"
                    >
                        {/* Composer */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                                <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                                    <Send size={14} className="text-indigo-400" /> Publicar no feed
                                </h3>

                                <div className="flex gap-2 mb-4">
                                    {(["system", "victory"] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setPostType(t)}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border
                                                ${postType === t
                                                    ? "bg-indigo-600 border-indigo-500 text-white"
                                                    : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"}`}
                                        >
                                            {t === "system" ? "📢 Anúncio" : "🏆 Conquista"}
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    value={text}
                                    onChange={e => setText(e.target.value.slice(0, 1000))}
                                    placeholder={postType === "system"
                                        ? "Ex: Semana de desafio de hidratação chegando! Quem beber 3L por 7 dias ganha 500 NutriCoins 💧"
                                        : "Ex: Parabéns às rainhas que completaram o protocolo de 21 dias! 🏆"
                                    }
                                    className="w-full bg-white/5 border border-white/10 text-sm text-slate-200 placeholder-slate-600 resize-none px-4 py-3 rounded-2xl focus:outline-none focus:border-indigo-500/50 min-h-[100px]"
                                    rows={4}
                                />

                                {/* Nivel minimo selector */}
                                <div className="mt-3 mb-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                                        <Lock size={10} /> Nível mínimo de acesso
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {NIVEL_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setNivelMinimo(opt.value)}
                                                className={`px-3 py-2 rounded-xl border text-left transition-all
                                                    ${nivelMinimo === opt.value
                                                        ? `${opt.bg} ${opt.color}`
                                                        : "bg-white/5 border-white/10 text-slate-600 hover:text-slate-400"}`}
                                            >
                                                <p className="text-xs font-bold">{opt.label}</p>
                                                <p className="text-[10px] opacity-70 mt-0.5">{opt.desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <div
                                            onClick={() => setPinPost(!pinPost)}
                                            className={`w-8 h-4 rounded-full transition-all relative ${pinPost ? "bg-indigo-600" : "bg-white/10"}`}
                                        >
                                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${pinPost ? "left-4" : "left-0.5"}`} />
                                        </div>
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Pin size={11} /> Fixar no topo
                                        </span>
                                    </label>
                                    <button
                                        onClick={handlePost}
                                        disabled={!text.trim() || posting}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all"
                                    >
                                        {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                        Publicar
                                    </button>
                                </div>
                            </div>

                            {/* Type breakdown */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-4">Posts por tipo</p>
                                <div className="space-y-2">
                                    {Object.entries(TYPE_LABELS).map(([type, meta]) => (
                                        <div key={type} className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400 flex items-center gap-1.5">
                                                {meta.emoji} {meta.label}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500/60 rounded-full"
                                                        style={{ width: `${stats.total ? Math.round(((stats.types[type] || 0) / stats.total) * 100) : 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-white w-5 text-right">{stats.types[type] || 0}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Feed list */}
                        <div className="lg:col-span-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Feed do clube</p>

                            {loading ? (
                                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-600" size={24} /></div>
                            ) : posts.length === 0 ? (
                                <div className="text-center py-16 text-slate-600">
                                    <Users size={32} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">Nenhum post ainda.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                                    {posts.map(post => {
                                        const typeMeta = TYPE_LABELS[post.type] || TYPE_LABELS.text
                                        const nivelOpt = NIVEL_OPTIONS.find(o => o.value === (post.nivel_minimo || 1))
                                        return (
                                            <motion.div
                                                key={post.id}
                                                layout
                                                className={`bg-white/5 border rounded-2xl px-4 py-3 flex gap-3 group
                                                    ${post.is_pinned ? "border-amber-500/30 bg-amber-500/5" : post.oculto ? "border-rose-500/20 opacity-50" : "border-white/10"}`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        {post.is_pinned && <Crown size={11} className="text-amber-400" />}
                                                        {post.oculto && <EyeOff size={11} className="text-rose-400" />}
                                                        <span className={`text-[10px] font-bold ${typeMeta.color}`}>
                                                            {typeMeta.emoji} {typeMeta.label}
                                                        </span>
                                                        {nivelOpt && nivelOpt.value > 1 && (
                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${nivelOpt.bg} ${nivelOpt.color}`}>
                                                                <Lock size={8} className="inline mr-0.5" />{nivelOpt.label}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-slate-600">·</span>
                                                        <span className="text-[10px] text-slate-500 font-bold">{post.author_name?.split(' ')[0]}</span>
                                                        <span className="text-[10px] text-slate-600">·</span>
                                                        <span className="text-[10px] text-slate-700">{timeAgo(post.created_at)}</span>
                                                        {post.reaction_count > 0 && (
                                                            <>
                                                                <span className="text-[10px] text-slate-600">·</span>
                                                                <span className="text-[10px] text-slate-500">🔥 {post.reaction_count}</span>
                                                            </>
                                                        )}
                                                        {post.comentario_count > 0 && (
                                                            <>
                                                                <span className="text-[10px] text-slate-600">·</span>
                                                                <span className="text-[10px] text-slate-500">💬 {post.comentario_count}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">{post.body}</p>
                                                </div>
                                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    <button
                                                        onClick={() => handlePin(post.id)}
                                                        title={post.is_pinned ? "Desafixar" : "Fixar"}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
                                                            ${post.is_pinned ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-slate-600 hover:text-amber-400"}`}
                                                    >
                                                        <Pin size={11} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleOculto(post.id)}
                                                        title={post.oculto ? "Mostrar" : "Ocultar"}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
                                                            ${post.oculto ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-600 hover:text-rose-400"}`}
                                                    >
                                                        {post.oculto ? <Eye size={11} /> : <EyeOff size={11} />}
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDelete(post.id)}
                                                        className="w-7 h-7 rounded-lg bg-white/5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-all"
                                                    >
                                                        <Trash2 size={11} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {activeTab === "moderacao" && (
                    <motion.div
                        key="moderacao"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-indigo-400" /> Moderação de Comentários
                                    </h3>
                                    <p className="text-[11px] text-slate-600 mt-0.5">Oculte comentários inadequados</p>
                                </div>
                                <button onClick={loadComentarios} className="text-slate-600 hover:text-slate-400 transition-colors">
                                    <RefreshCw size={14} />
                                </button>
                            </div>

                            {loadingComentarios ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="animate-spin text-slate-600" size={20} />
                                </div>
                            ) : comentarios.length === 0 ? (
                                <div className="text-center py-10 text-slate-600">
                                    <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Nenhum comentário ainda.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {comentarios.map(c => (
                                        <div
                                            key={c.id}
                                            className={`flex items-start gap-3 px-4 py-3 rounded-2xl border transition-all
                                                ${c.oculto ? "border-rose-500/20 bg-rose-500/5 opacity-60" : "border-white/10 bg-white/[0.02]"}`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    {c.oculto && <EyeOff size={10} className="text-rose-400" />}
                                                    <span className="text-[11px] font-bold text-slate-400">{c.author_name?.split(' ')[0]}</span>
                                                    <span className="text-[10px] text-slate-700">{timeAgo(c.criado_em)}</span>
                                                </div>
                                                <p className="text-sm text-slate-300 leading-relaxed">{c.corpo}</p>
                                            </div>
                                            <button
                                                onClick={() => handleToggleComentario(c.id)}
                                                title={c.oculto ? "Mostrar comentário" : "Ocultar comentário"}
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
                                                    ${c.oculto
                                                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                                        : "bg-white/5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10"}`}
                                            >
                                                {c.oculto ? <Eye size={11} /> : <EyeOff size={11} />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Posts moderation */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                            <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-4">
                                <EyeOff size={14} className="text-rose-400" /> Posts Ocultos
                            </h3>
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin text-slate-600" size={18} />
                                </div>
                            ) : posts.filter(p => p.oculto).length === 0 ? (
                                <p className="text-sm text-slate-600 text-center py-6">Nenhum post oculto.</p>
                            ) : (
                                <div className="space-y-2">
                                    {posts.filter(p => p.oculto).map(post => {
                                        const typeMeta = TYPE_LABELS[post.type] || TYPE_LABELS.text
                                        return (
                                            <div key={post.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-rose-500/20 bg-rose-500/5">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className={`text-[10px] font-bold ${typeMeta.color}`}>{typeMeta.emoji} {typeMeta.label}</span>
                                                        <span className="text-[10px] text-slate-600">· {post.author_name?.split(' ')[0]}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 line-clamp-1">{post.body}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleOculto(post.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all flex-shrink-0"
                                                >
                                                    <Eye size={11} /> Mostrar
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete confirm modal */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setConfirmDelete(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center">
                                    <AlertCircle size={20} className="text-rose-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-white">Remover post?</p>
                                    <p className="text-xs text-slate-500">Esta ação não pode ser desfeita.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmDelete(null)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm font-bold">
                                    Cancelar
                                </button>
                                <button onClick={() => handleDelete(confirmDelete)}
                                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-all">
                                    Remover
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
