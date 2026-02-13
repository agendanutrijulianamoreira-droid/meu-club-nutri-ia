"use client"

import { useState } from "react"
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
import { motion } from "framer-motion"
import Link from "next/link"

export default function CommunityPage() {
    const [posts, setPosts] = useState([
        {
            id: 1,
            user: "Julia Silva",
            level: 12,
            isQueen: true,
            avatar: "https://api.dicebear.com/9.x/micah/svg?seed=Julia",
            content: "Meninas, completei os 7 dias do desafio sem açúcar! A diferença na disposição é surreal. Quem vem comigo na próxima semana? 🚀",
            image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80&w=600",
            likes: 42,
            comments: 8,
            time: "2h atrás",
            isLiked: true
        },
        {
            id: 2,
            user: "Carla Dias",
            level: 8,
            isQueen: false,
            avatar: "https://api.dicebear.com/9.x/micah/svg?seed=Carla",
            content: "Dica de shot matinal: Limão + Cúrcuma + Gengibre. Acorda o corpo e desinflama de verdade! 🍵",
            image: null,
            likes: 24,
            comments: 3,
            time: "5h atrás",
            isLiked: false
        }
    ])

    const toggleLike = (id: number) => {
        setPosts(prev => prev.map(p => {
            if (p.id === id) {
                return { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
            }
            return p
        }))
    }

    const handlePost = () => {
        alert('Postagem enviada para a Tribo! +10 XP 🚀')
    }

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
                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">128 Rainhas em Evolução</p>
                        </div>
                    </div>
                    <button className="bg-white/5 p-3 rounded-2xl hover:bg-white/10 border border-white/5 transition backdrop-blur-md">
                        <MoreHorizontal size={20} className="text-slate-400" />
                    </button>
                </div>
            </header>

            {/* Conteúdo do Feed */}
            <div className="max-w-md mx-auto pt-28 px-6 space-y-8">

                {/* CRIAR POST (Destaque Clinical) */}
                <div className="glass-panel p-5 rounded-[2.5rem] border border-indigo-500/20 bg-indigo-500/5 flex items-center gap-4 shadow-2xl">
                    <div className="h-14 w-14 rounded-2xl border border-indigo-500/30 p-0.5 bg-slate-900">
                        <img src="https://api.dicebear.com/9.x/micah/svg?seed=JuliaQueen" className="w-full h-full rounded-xl object-cover" alt="Me" />
                    </div>
                    <input
                        type="text"
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
                            {/* User Header */}
                            <div className="p-6 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="h-14 w-14 rounded-2xl bg-slate-800 p-0.5 border border-white/10">
                                            <img src={post.avatar} className="w-full h-full rounded-xl bg-slate-900" alt={post.user} />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-[10px] font-black px-2 py-1 rounded-lg border-2 border-slate-900 text-white">
                                            L{post.level}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-bold text-white">{post.user}</h3>
                                            {post.isQueen && (
                                                <div className="bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                                                    <Sparkles size={10} className="text-amber-400" />
                                                    <span className="text-[8px] font-black text-amber-400 uppercase tracking-tighter">Rainha</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{post.time}</p>
                                    </div>
                                </div>
                                <button className="text-slate-600 hover:text-white transition-colors">
                                    <MoreHorizontal size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="px-6 pb-5">
                                <p className="text-[15px] leading-relaxed text-slate-300 font-light">
                                    {post.content}
                                </p>
                            </div>

                            {/* Image */}
                            {post.image && (
                                <div className="px-4 pb-4">
                                    <div className="h-72 w-full rounded-[2rem] overflow-hidden border border-white/5 shadow-inner">
                                        <img src={post.image} className="w-full h-full object-cover" alt="Post" />
                                    </div>
                                </div>
                            )}

                            {/* Footer Actions */}
                            <div className="px-6 py-5 bg-white/[0.02] flex items-center justify-between border-t border-white/5">
                                <div className="flex items-center gap-8">
                                    <button
                                        onClick={() => toggleLike(post.id)}
                                        className={`flex items-center gap-2.5 text-xs font-black transition-all ${post.isLiked ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-indigo-400'}`}
                                    >
                                        <Heart size={20} fill={post.isLiked ? "currentColor" : "none"} className={post.isLiked ? "drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" : ""} />
                                        {post.likes}
                                    </button>
                                    <button className="flex items-center gap-2.5 text-xs text-slate-500 font-black hover:text-indigo-400 transition-all">
                                        <MessageSquare size={20} />
                                        {post.comments}
                                    </button>
                                </div>
                                <button className="text-slate-500 hover:text-indigo-400 transition-all">
                                    <Share2 size={20} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Bottom Nav Bar (Flutuante Premium) */}
            <div className="fixed bottom-8 left-6 right-6 z-50">
                <div className="max-w-md mx-auto glass-panel p-2.5 rounded-[2.5rem] border border-white/10 bg-slate-950/80 backdrop-blur-2xl shadow-2xl flex justify-around items-center">
                    <Link href="/" className="p-4 rounded-2xl text-slate-500 transition-all hover:text-indigo-400">
                        <HomeIcon size={24} />
                    </Link>
                    <Link href="/protocolo" className="p-4 rounded-2xl text-slate-500 transition-all hover:text-indigo-400">
                        <Utensils size={24} />
                    </Link>

                    <div className="relative -top-8">
                        <div className="absolute -inset-6 bg-indigo-600/30 blur-3xl rounded-full" />
                        <button className="relative bg-gradient-to-tr from-indigo-600 to-violet-600 w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-indigo-900/50 border-4 border-slate-900 active:scale-90 transition-all rotate-45">
                            <Plus className="text-white -rotate-45" size={32} />
                        </button>
                    </div>

                    <Link href="/comunidade" className="p-4 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
                        <MessageSquare size={24} fill="currentColor" />
                    </Link>
                    <Link href="/perfil" className="p-4 rounded-2xl text-slate-500 transition-all hover:text-indigo-400">
                        <UserIcon size={24} />
                    </Link>
                </div>
            </div>

        </div>
    )
}

function HomeIcon(props: any) { return <Home size={props.size || 24} {...props} /> }
function UserIcon(props: any) { return <User size={props.size || 24} {...props} /> }
