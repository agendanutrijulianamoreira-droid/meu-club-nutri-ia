"use client"

import { useState } from "react"
import {
    Search,
    Clock,
    Flame,
    Bookmark,
    ChevronRight,
    Sparkles,
    Utensils,
    Home,
    MessageSquare,
    User,
    Plus,
    Brain,
    ChefHat,
    ArrowUpRight
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

export default function RecipesPage() {
    const [activeCategory, setActiveCategory] = useState("Todas")

    const [bookmarked, setBookmarked] = useState<number[]>([])

    const toggleBookmark = (id: number) => {
        setBookmarked(prev =>
            prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
        )
    }

    const handleActivateProtocol = () => {
        alert('Protocolo Bio-Gastronômico ativado! Seus ingredientes foram adicionados à lista de compras. ✨')
    }

    const categories = [
        { id: "Todas", icon: "✨", label: "Todas" },
        { id: "Shots", icon: "🍵", label: "Shots" },
        { id: "Café", icon: "🍳", label: "Desjejum" },
        { id: "Almoço", icon: "🥗", label: "Almoço/Jantar" },
        { id: "Snacks", icon: "🍎", label: "Snacks" },
        { id: "Sucos", icon: "🥤", label: "Sucos" }
    ]

    const recipes = [
        {
            id: 1,
            title: "Shot Anti-Inflamatório",
            category: "Shots",
            calories: 15,
            time: "2 min",
            difficulty: "Fácil",
            image: "https://images.unsplash.com/photo-1600262911413-ca4865aa4e79?auto=format&fit=crop&q=80&w=500"
        },
        {
            id: 2,
            title: "Salmão com Crosta de Ervas",
            category: "Almoço",
            calories: 420,
            time: "25 min",
            difficulty: "Média",
            image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&q=80&w=500"
        },
        {
            id: 3,
            title: "Overnight Oats de Chia",
            category: "Café",
            calories: 280,
            time: "10 min",
            difficulty: "Fácil",
            image: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&q=80&w=500"
        },
        {
            id: 4,
            title: "Suco Verde da Rainha",
            category: "Sucos",
            calories: 95,
            time: "5 min",
            difficulty: "Fácil",
            image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=500"
        },
    ]

    const filteredRecipes = activeCategory === "Todas"
        ? recipes
        : recipes.filter(r => r.category === activeCategory)

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 pb-40 overflow-x-hidden">
            {/* --- PREMIUM BACKGROUND --- */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b] -z-10" />

            {/* Header com Busca Premium */}
            <div className="p-8 pt-16 bg-gradient-to-b from-indigo-900/10 to-transparent">
                <header className="mb-10 flex flex-col items-center text-center">
                    <div className="h-16 w-16 rounded-[2rem] bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-6 shadow-2xl">
                        <ChefHat size={32} className="text-indigo-400" />
                    </div>
                    <h1 className="text-4xl font-light text-white tracking-tight mb-2 italic">Gastronomia <span className="font-bold">Real</span></h1>
                    <p className="text-slate-500 text-sm font-medium tracking-wide">ALTA PERFORMANCE GASTRONÔMICA</p>
                </header>

                <div className="relative group max-w-md mx-auto">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <Search size={22} className="text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Pesquisar Bio-ingredientes..."
                        className="w-full h-16 bg-white/5 border border-white/10 rounded-[1.5rem] pl-14 pr-6 text-base focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-600 font-medium"
                    />
                </div>
            </div>

            {/* Categorias - Slider Profissional */}
            <div className="px-6 mb-12">
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex items-center gap-3 px-6 py-4 rounded-2xl whitespace-nowrap text-sm font-black uppercase tracking-widest transition-all border ${activeCategory === cat.id
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-900/40 translate-y-[-2px]'
                                : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10'
                                }`}
                        >
                            <span>{cat.icon}</span>
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Destaque: Protocolo do Dia GLASS */}
            <div className="px-6 mb-12">
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative glass-panel p-8 rounded-[2.5rem] border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 overflow-hidden shadow-2xl"
                >
                    <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/20 blur-[100px] rounded-full" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-4">
                            <Brain size={14} /> Sugestão da sua Consultoria IA
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">Café da Manhã Anti-Inflamatório</h2>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed font-light">Combine o <span className="text-indigo-400 font-bold">Shot de Cúrcuma</span> com Ovos Orgânicos para otimizar o transporte de nutrientes e reduzir o cortisol matinal.</p>
                        <button
                            onClick={handleActivateProtocol}
                            className="flex items-center gap-3 px-6 py-4 bg-indigo-600/20 border border-indigo-500/40 rounded-2xl text-xs font-black text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all group tracking-widest uppercase"
                        >
                            Ativar Protocolo <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Grid de Receitas Premium */}
            <div className="px-6 grid grid-cols-2 gap-8">
                <AnimatePresence mode="popLayout">
                    {filteredRecipes.map((recipe, i) => (
                        <motion.div
                            layout
                            key={recipe.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ delay: i * 0.05 }}
                            className="group cursor-pointer"
                        >
                            <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden mb-5 shadow-2xl border border-white/5">
                                <img
                                    src={recipe.image}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
                                    alt={recipe.title}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        toggleBookmark(recipe.id)
                                    }}
                                    className={`absolute top-5 right-5 h-11 w-11 rounded-2xl flex items-center justify-center transition-all border ${bookmarked.includes(recipe.id) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 backdrop-blur-xl text-white border-white/10 hover:bg-white/10'}`}
                                >
                                    <Bookmark size={18} fill={bookmarked.includes(recipe.id) ? 'currentColor' : 'none'} />
                                </button>
                                <div className="absolute bottom-5 left-5 right-5">
                                    <span className="text-[9px] font-black bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-xl uppercase tracking-widest backdrop-blur-md">
                                        {recipe.category}
                                    </span>
                                </div>
                            </div>
                            <h3 className="text-base font-bold text-white mb-2 leading-tight px-1 group-hover:text-indigo-400 transition-colors">{recipe.title}</h3>
                            <div className="flex items-center gap-5 px-1 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                <span className="flex items-center gap-2 font-black"><Clock size={14} className="text-indigo-400" /> {recipe.time}</span>
                                <span className="flex items-center gap-2"><Flame size={14} className="text-amber-500" /> {recipe.calories} kcal</span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Bottom Nav Bar Premium */}
            <div className="fixed bottom-8 left-6 right-6 z-50">
                <div className="max-w-md mx-auto glass-panel p-2.5 rounded-[2.5rem] border border-white/10 bg-slate-950/80 backdrop-blur-2xl shadow-2xl flex justify-around items-center">
                    <Link href="/" className="p-4 rounded-2xl text-slate-500 transition-all hover:text-indigo-400">
                        <HomeIcon size={24} />
                    </Link>
                    <Link href="/protocolo" className="p-4 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
                        <Utensils size={24} />
                    </Link>

                    <div className="relative -top-8">
                        <div className="absolute -inset-6 bg-indigo-600/30 blur-3xl rounded-full" />
                        <button className="relative bg-gradient-to-tr from-indigo-600 to-violet-600 w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-indigo-900/50 border-4 border-slate-900 active:scale-90 transition-all rotate-45">
                            <Plus className="text-white -rotate-45" size={32} />
                        </button>
                    </div>

                    <Link href="/comunidade" className="p-4 rounded-2xl text-slate-500 transition-all hover:text-indigo-400">
                        <MessageSquare size={24} />
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
