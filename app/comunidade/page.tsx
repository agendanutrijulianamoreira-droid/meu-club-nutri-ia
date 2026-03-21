"use client"

import { useState, useEffect } from "react"
import {
    MessageSquare,
    Heart,
    Share2,
    Brain,
    Star,
    MoreHorizontal,
    Plus,
    Home,
    User,
    Utensils,
    Sparkles
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { supabase } from "@/lib/supabase-browser"

export default function CommunityPage() {
    const [posts, setPosts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [newPostContent, setNewPostContent] = useState("")
    const [userProfile, setUserProfile] = useState<any>(null)

    useEffect(() => {
        async function loadInitialData() {
            // 1. Get User Profile
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()
                setUserProfile(profile)
            }

            // 2. Load Posts
            const { data: postsData } = await supabase
                .from('posts')
                .select(`
                    *,
                    profiles:user_id (name, avatar_url, current_level)
                `)
                .order('created_at', { ascending: false })
            
            if (postsData) setPosts(postsData)
            setLoading(false)
        }
        loadInitialData()
    }, [supabase])

    const toggleLike = async (postId: string) => {
        const post = posts.find(p => p.id === postId)
        if (!post) return

        // Optimistic UI
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                return { 
                    ...p, 
                    isLiked: !p.isLiked, 
                    likes_count: p.isLiked ? p.likes_count - 1 : p.likes_count + 1 
                }
            }
            return p
        }))

        // Database Update
        if (post.isLiked) {
            await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userProfile.user_id)
        } else {
            await supabase.from('post_likes').insert({ post_id: postId, user_id: userProfile.user_id })
        }
    }

    const handlePost = async () => {
        if (!newPostContent.trim()) return

        const { data: newPost, error } = await supabase
            .from('posts')
            .insert({
                user_id: userProfile.user_id,
                tenant_id: userProfile.tenant_id,
                content: newPostContent,
                type: 'post'
            })
            .select(`
                *,
                profiles:user_id (name, avatar_url, current_level)
            `)
            .single()

        if (newPost) {
            setPosts([newPost, ...posts])
            setNewPostContent("")
            alert('Postagem enviada para a Tribo! +10 XP 🚀')

            // Trigger Community Moderation Agent
            fetch('/api/trigger-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'post_created',
                    payload: { post_id: newPost.id },
                }),
            }).catch(() => {}) // fire-and-forget
        }
    }

    if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">Carregando Tribo...</div>

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 pb-32 overflow-x-hidden">
            {/* --- PREMIUM BACKGROUND --- */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b] -z-10" />

            {/* Header Fixo Premium */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/80 backdrop-blur-2xl border-b border-white/10 px-6 py-5">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-900/20">
                            <Brain size={22} className="text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Tribo Real</h1>
                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">{posts.length}+ Rainhas em Evolução</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-md mx-auto pt-28 px-6 space-y-8">
                {/* CRIAR POST */}
                <div className="glass-panel p-5 rounded-[2.5rem] border border-indigo-500/20 bg-indigo-500/5 flex items-center gap-4 shadow-2xl">
                    <div className="h-14 w-14 rounded-2xl border border-indigo-500/30 p-0.5 bg-slate-900 overflow-hidden">
                        <img src={userProfile?.avatar_url || "https://api.dicebear.com/9.x/micah/svg?seed=Queen"} className="w-full h-full object-cover" alt="Me" />
                    </div>
                    <input
                        type="text"
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder="Compartilhe seu progresso, Rainha..."
                        className="bg-transparent flex-1 text-sm outline-none placeholder:text-slate-600 font-medium"
                    />
                    <button
                        onClick={handlePost}
                        className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-900/40 hover:bg-indigo-500 transition-all"
                    >
                        <Plus size={24} />
                    </button>
                </div>

                {/* LISTA DE POSTS */}
                <div className="space-y-8">
                    {posts.map((post, i) => (
                        <motion.div
                            key={post.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1, ease: "easeOut" }}
                            className="rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="h-14 w-14 rounded-2xl bg-slate-800 p-0.5 border border-white/10 overflow-hidden">
                                            <img src={post.profiles?.avatar_url || `https://api.dicebear.com/9.x/micah/svg?seed=${post.user_id}`} className="w-full h-full rounded-xl bg-slate-900" alt={post.profiles?.name} />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-[10px] font-black px-2 py-1 rounded-lg border-2 border-slate-900 text-white">
                                            L{post.profiles?.current_level || 1}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-bold text-white">{post.profiles?.name || 'Rainha'}</h3>
                                            {post.type === 'achievement' && (
                                                <div className="bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                                                    <Sparkles size={10} className="text-amber-400" />
                                                    <span className="text-[8px] font-black text-amber-400 uppercase tracking-tighter">Conquista</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                            {new Date(post.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 pb-5">
                                <p className="text-[15px] leading-relaxed text-slate-300 font-light">
                                    {post.content}
                                </p>
                            </div>

                            {post.image_url && (
                                <div className="px-4 pb-4">
                                    <div className="h-72 w-full rounded-[2rem] overflow-hidden border border-white/5 shadow-inner">
                                        <img src={post.image_url} className="w-full h-full object-cover" alt="Post" />
                                    </div>
                                </div>
                            )}

                            <div className="px-6 py-5 bg-white/[0.02] flex items-center justify-between border-t border-white/5">
                                <div className="flex items-center gap-8">
                                    <button
                                        onClick={() => toggleLike(post.id)}
                                        className={`flex items-center gap-2.5 text-xs font-black transition-all ${post.isLiked ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-indigo-400'}`}
                                    >
                                        <Heart size={20} fill={post.isLiked ? "currentColor" : "none"} />
                                        {post.likes_count}
                                    </button>
                                    <button className="flex items-center gap-2.5 text-xs text-slate-500 font-black hover:text-indigo-400 transition-all">
                                        <MessageSquare size={20} />
                                        {post.comments_count}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Bottom Nav Bar (Flutuante Premium) */}
            <div className="fixed bottom-8 left-6 right-6 z-50">
                <div className="max-w-md mx-auto glass-panel p-2.5 rounded-[2.5rem] border border-white/10 bg-slate-950/80 backdrop-blur-2xl shadow-2xl flex justify-around items-center">
                    <Link href="/" className="p-4 rounded-2xl text-slate-500 transition-all hover:text-indigo-400">
                        <Home size={24} />
                    </Link>
                    <Link href="/protocolo" className="p-4 rounded-2xl text-slate-500 transition-all hover:text-indigo-400">
                        <Utensils size={24} />
                    </Link>
                    <Link href="/comunidade" className="p-4 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
                        <MessageSquare size={24} fill="currentColor" />
                    </Link>
                </div>
            </div>
        </div>
    )
}
