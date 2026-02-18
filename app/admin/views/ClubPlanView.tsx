"use client"

import { useState, useEffect } from "react"
import {
    Sparkles,
    Calendar,
    ChevronRight,
    Loader2,
    Save,
    Edit3,
    Check,
    RefreshCw,
    Zap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { generateClubPlan, saveClubPlan, loadClubPlan } from "../actions/clubPlanActions"

interface MonthPlan {
    month: number
    monthName: string
    theme: string
    protocol_title: string
    challenge_title: string
    inbox_templates: string[]
    upgrade_cta: string
}

export function ClubPlanView({ setView, tenantId = '' }: { setView: (v: any) => void, tenantId?: string }) {
    const [months, setMonths] = useState<MonthPlan[]>([])
    const [planType, setPlanType] = useState<'semestral' | 'anual'>('semestral')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editingMonth, setEditingMonth] = useState<number | null>(null)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<string | null>(null)

    // Load existing plan on mount
    useEffect(() => {
        loadExisting('semestral')
    }, [])

    const loadExisting = async (type: 'semestral' | 'anual') => {
        setPlanType(type)
        setLoading(true)
        try {
            const result = await loadClubPlan(type)
            if (result.months && result.months.length > 0) {
                setMonths(result.months)
                setLastUpdated(result.updatedAt || null)
            } else {
                setMonths([])
                setLastUpdated(null)
            }
        } catch (err) {
            console.error("Erro ao carregar plano:", err)
        } finally {
            setLoading(false)
            setHasLoaded(true)
        }
    }

    const handleGenerate = async (type: 'semestral' | 'anual') => {
        setPlanType(type)
        setLoading(true)
        try {
            const result = await generateClubPlan(type)
            if (result.months) {
                setMonths(result.months)
                setLastUpdated(new Date().toISOString())
            }
        } catch (err) {
            console.error("Erro ao gerar plano:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await saveClubPlan(planType, months)
            setLastUpdated(new Date().toISOString())
        } catch (err) {
            console.error("Erro ao salvar:", err)
        } finally {
            setSaving(false)
        }
    }

    const updateMonth = (index: number, field: keyof MonthPlan, value: any) => {
        setMonths(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
    }

    // Empty state
    if (hasLoaded && months.length === 0 && !loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-lg w-full text-center space-y-8"
                >
                    <div className="h-24 w-24 bg-violet-600/20 rounded-3xl flex items-center justify-center mx-auto border border-violet-500/30">
                        <Calendar size={48} className="text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white mb-2">Plano do Clube</h2>
                        <p className="text-slate-400 text-lg">Gere um plano estratégico completo com IA em 1 clique.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button
                            onClick={() => handleGenerate('semestral')}
                            disabled={loading}
                            className="h-16 px-8 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-violet-900/40 gap-3"
                        >
                            {loading && planType === 'semestral' ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                            Plano Semestral (6 meses)
                        </Button>
                        <Button
                            onClick={() => handleGenerate('anual')}
                            disabled={loading}
                            className="h-16 px-8 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-900/40 gap-3"
                        >
                            {loading && planType === 'anual' ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                            Plano Anual (12 meses)
                        </Button>
                    </div>

                    {/* Tabs to check existing */}
                    <div className="flex justify-center gap-4 pt-4">
                        <button onClick={() => loadExisting('semestral')} className="text-xs text-slate-500 hover:text-indigo-400 transition uppercase tracking-widest font-bold">
                            Carregar Semestral
                        </button>
                        <span className="text-slate-700">|</span>
                        <button onClick={() => loadExisting('anual')} className="text-xs text-slate-500 hover:text-indigo-400 transition uppercase tracking-widest font-bold">
                            Carregar Anual
                        </button>
                    </div>
                </motion.div>
            </div>
        )
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 size={48} className="animate-spin text-violet-400 mx-auto" />
                    <p className="text-slate-400 font-bold">Gerando plano {planType} com IA...</p>
                </div>
            </div>
        )
    }

    // Filled state: Monthly cards
    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-white">
                        Plano {planType === 'semestral' ? 'Semestral' : 'Anual'}
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        {months.length} meses planejados
                        {lastUpdated && ` • Atualizado em ${new Date(lastUpdated).toLocaleDateString('pt-BR')}`}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={() => handleGenerate(planType)}
                        variant="outline"
                        className="h-12 border-white/10 text-slate-300 rounded-xl gap-2 hover:bg-white/5"
                    >
                        <RefreshCw size={16} /> Regenerar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="h-12 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold gap-2"
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Salvar Plano
                    </Button>
                </div>
            </div>

            {/* Plan type toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => loadExisting('semestral')}
                    className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${planType === 'semestral' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-500 hover:text-white'
                        }`}
                >
                    Semestral
                </button>
                <button
                    onClick={() => loadExisting('anual')}
                    className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${planType === 'anual' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-white'
                        }`}
                >
                    Anual
                </button>
            </div>

            {/* Monthly Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <AnimatePresence>
                    {months.map((month, index) => (
                        <motion.div
                            key={`${month.monthName}-${index}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="rounded-[2rem] p-6 bg-white/5 backdrop-blur-md border border-white/10 hover:border-violet-500/30 transition-all group relative"
                        >
                            {/* Month Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-violet-500/20 h-10 w-10 rounded-xl flex items-center justify-center border border-violet-500/30">
                                        <span className="text-violet-300 font-black text-sm">{month.month}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{month.monthName}</h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditingMonth(editingMonth === index ? null : index)}
                                    className="text-slate-500 hover:text-violet-400 transition p-2"
                                >
                                    {editingMonth === index ? <Check size={16} /> : <Edit3 size={16} />}
                                </button>
                            </div>

                            {/* Theme */}
                            <div className="mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Tema</span>
                                {editingMonth === index ? (
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-violet-500"
                                        value={month.theme}
                                        onChange={e => updateMonth(index, 'theme', e.target.value)}
                                    />
                                ) : (
                                    <p className="text-violet-300 font-bold">{month.theme}</p>
                                )}
                            </div>

                            {/* Protocol */}
                            <div className="mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Protocolo</span>
                                {editingMonth === index ? (
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-violet-500"
                                        value={month.protocol_title}
                                        onChange={e => updateMonth(index, 'protocol_title', e.target.value)}
                                    />
                                ) : (
                                    <p className="text-white text-sm">{month.protocol_title}</p>
                                )}
                            </div>

                            {/* Challenge */}
                            <div className="mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Desafio</span>
                                {editingMonth === index ? (
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-violet-500"
                                        value={month.challenge_title}
                                        onChange={e => updateMonth(index, 'challenge_title', e.target.value)}
                                    />
                                ) : (
                                    <p className="text-amber-300 text-sm font-medium">{month.challenge_title}</p>
                                )}
                            </div>

                            {/* Upgrade CTA */}
                            <div className="mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Oferta Upsell</span>
                                {editingMonth === index ? (
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-violet-500"
                                        value={month.upgrade_cta}
                                        onChange={e => updateMonth(index, 'upgrade_cta', e.target.value)}
                                    />
                                ) : (
                                    <p className="text-emerald-300 text-xs">{month.upgrade_cta}</p>
                                )}
                            </div>

                            {/* Inbox Templates (collapsed) */}
                            <div className="mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                                    Templates de Inbox ({month.inbox_templates?.length || 0})
                                </span>
                                <div className="space-y-1">
                                    {month.inbox_templates?.map((t, ti) => (
                                        <p key={ti} className="text-slate-400 text-xs truncate">{t}</p>
                                    ))}
                                </div>
                            </div>

                            {/* Generate Protocol CTA */}
                            <Button
                                onClick={() => {
                                    setView('protocols')
                                }}
                                variant="outline"
                                className="w-full mt-2 border-violet-500/20 text-violet-300 hover:bg-violet-500/10 rounded-xl text-xs font-bold gap-2"
                            >
                                <Zap size={14} /> Gerar Protocolo deste Mês
                            </Button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}
