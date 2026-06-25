"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ClipboardList, ChevronRight, Check, Loader2, Clock } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase-browser"

interface Questionnaire {
    id: string
    name: string
    description: string | null
    estimated_minutes: number
    answered: boolean
}

export default function PatientQuestionnairesPage() {
    const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('user_id', user.id)
                .single()

            if (!profile?.tenant_id) { setLoading(false); return }

            const [{ data: activeQs }, { data: answered }] = await Promise.all([
                supabase.from('questionnaires').select('id, name, description, estimated_minutes').eq('tenant_id', profile.tenant_id).eq('is_active', true),
                supabase.from('questionnaire_responses').select('questionnaire_id').eq('patient_id', user.id),
            ])

            const answeredIds = new Set((answered || []).map((r: any) => r.questionnaire_id))
            const list: Questionnaire[] = (activeQs || []).map((q: any) => ({
                ...q,
                answered: answeredIds.has(q.id),
            }))

            // Sort: pending first, then answered
            list.sort((a, b) => Number(a.answered) - Number(b.answered))
            setQuestionnaires(list)
            setLoading(false)
        }
        load()
    }, [])

    const pending = questionnaires.filter(q => !q.answered)
    const done = questionnaires.filter(q => q.answered)

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1a2b]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 pt-12 pb-4">
                <div className="max-w-md mx-auto flex items-center gap-3">
                    <Link href="/patient/home"
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <ChevronLeft size={18} className="text-white" />
                    </Link>
                    <div className="flex-1">
                        <p className="text-white text-sm font-black">Questionários</p>
                        <p className="text-slate-500 text-[10px]">Formulários enviados pela sua nutricionista</p>
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-6 pb-28 space-y-6">
                {loading && (
                    <div className="flex justify-center py-16">
                        <Loader2 size={28} className="animate-spin text-violet-400" />
                    </div>
                )}

                {!loading && questionnaires.length === 0 && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="text-center py-16">
                        <div className="w-16 h-16 rounded-3xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                            <ClipboardList size={28} className="text-violet-400" />
                        </div>
                        <h2 className="text-white font-black text-lg mb-1">Nenhum questionário</h2>
                        <p className="text-slate-500 text-sm">Sua nutricionista ainda não enviou nenhum formulário.</p>
                    </motion.div>
                )}

                {!loading && pending.length > 0 && (
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-3">Pendentes</p>
                        <div className="space-y-3">
                            {pending.map((q, i) => (
                                <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                                    <Link href={`/patient/questionnaire/${q.id}`}>
                                        <div className="flex items-center gap-4 p-4 bg-violet-600/10 border border-violet-500/25 rounded-2xl hover:border-violet-400/40 group transition-all">
                                            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
                                                <ClipboardList className="text-violet-300" size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-bold text-sm truncate">{q.name}</p>
                                                {q.description && <p className="text-slate-500 text-xs truncate">{q.description}</p>}
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Clock size={10} className="text-slate-600" />
                                                    <span className="text-[10px] text-slate-600">~{q.estimated_minutes} min</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="text-violet-400 group-hover:translate-x-1 transition-transform flex-shrink-0" size={16} />
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {!loading && done.length > 0 && (
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-3">Respondidos</p>
                        <div className="space-y-2">
                            {done.map((q, i) => (
                                <motion.div key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                                    <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/8 rounded-2xl opacity-60">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center flex-shrink-0">
                                            <Check size={16} className="text-emerald-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-400 font-bold text-sm truncate">{q.name}</p>
                                            <p className="text-emerald-500 text-[10px] font-bold">Respondido</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
