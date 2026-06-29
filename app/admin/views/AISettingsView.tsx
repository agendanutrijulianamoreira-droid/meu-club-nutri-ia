"use client"

import React, { useState, useEffect, useCallback } from 'react'
import {
    Brain, Save, MessageCircle, Sliders, Smartphone, Check,
    Loader2, Bot, Play, Clock, CheckCircle, XCircle, RefreshCw,
    Bell, Sparkles, Plus, X, Zap, AlertCircle, Edit3, Eye,
    ChevronRight, Activity
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTenant } from '@/lib/hooks/useDatabase'

// ─── Types ────────────────────────────────────────────────────────────────────
const TONE_OPTIONS = [
    { id: 'acolhedora', label: '💖 A Acolhedora', desc: 'Foco em escuta e carinho. Ideal para ansiedade.' },
    { id: 'motivadora', label: '⭐ A Motivadora', desc: 'Energia alta, emojis e cobrança ativa.' },
    { id: 'tecnica',    label: '🔬 A Técnica',    desc: 'Direta, científica e sem rodeios.' },
] as const

type Tone = 'acolhedora' | 'motivadora' | 'tecnica'

const PREVIEW_MSGS: Record<Tone, { title: string; msg: string }> = {
    acolhedora: { title: "Check-in Matinal", msg: "Bom dia, querida! 💖 Como você acordou hoje? Lembre-se que estou aqui por você nesse processo. Vamos tomar aquele copo d'água juntas? 🌸" },
    motivadora: { title: "Desafio do Dia",   msg: "BORA RAINHA! 👑 O dia começou e sua meta não vai se bater sozinha! Já mandou o shot matinal? Seu corpo é seu templo! 🔥🚀" },
    tecnica:    { title: "Lembrete Clínico", msg: "Olá. Lembrete: 500ml de água em jejum ativa o metabolismo em ~24%. Mantenha constância na Fase 1. ✅" },
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ type, msg, onClose }: { type: 'success' | 'error'; msg: string; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold
                ${type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-rose-500/10 border-rose-500/25 text-rose-400'}`}>
            {type === 'success' ? <CheckCircle size={13}/> : <AlertCircle size={13}/>}
            {msg}
            <button onClick={onClose} className="ml-auto opacity-60 hover:opacity-100"><X size={11}/></button>
        </motion.div>
    )
}

// ─── Phone Preview ────────────────────────────────────────────────────────────
function PhonePreview({ tone, brandName }: { tone: Tone; brandName: string }) {
    const preview = PREVIEW_MSGS[tone]
    return (
        <div className="flex items-center justify-center">
            <div className="w-64 h-[480px] bg-slate-950 rounded-[2.5rem] border-[8px] border-slate-800 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-800 rounded-b-2xl z-20"/>
                {/* Screen */}
                <div className="bg-[#0b1016] h-full w-full pt-12 px-4 pb-5 flex flex-col">
                    {/* App header */}
                    <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-white/5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                            <Brain size={16} className="text-white"/>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">{brandName.split(' ')[0]}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                                <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse"/>
                                <p className="text-[8px] text-emerald-400 uppercase font-black">online</p>
                            </div>
                        </div>
                    </div>

                    {/* Chat */}
                    <div className="flex-1 space-y-3 overflow-hidden">
                        <AnimatePresence mode="wait">
                            <motion.div key={tone}
                                initial={{ opacity: 0, scale: 0.92, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="bg-[#1f2c34] p-3.5 rounded-2xl rounded-tl-none border border-white/5">
                                <p className="text-[8px] text-indigo-400 font-bold mb-1.5 uppercase tracking-wider">{preview.title}</p>
                                <p className="text-[11px] text-white leading-relaxed">{preview.msg}</p>
                                <p className="text-[7px] text-slate-600 text-right mt-1.5">09:41</p>
                            </motion.div>
                        </AnimatePresence>
                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                            className="bg-indigo-600 p-3 rounded-2xl rounded-tr-none max-w-[80%] ml-auto">
                            <p className="text-[11px] text-white">{tone === 'acolhedora' ? 'Obrigada! Vou tomar minha água 💖' : tone === 'motivadora' ? 'Feito! Missão cumprida. 🔥' : 'Entendido. Feito. ✓'}</p>
                            <p className="text-[7px] text-indigo-200 text-right mt-1 uppercase">Visualizada</p>
                        </motion.div>
                    </div>

                    {/* Input bar */}
                    <div className="bg-white/5 h-10 rounded-2xl flex items-center px-4 gap-2 mt-3 border border-white/5 opacity-40">
                        <div className="w-4 h-4 rounded-lg bg-white/10"/>
                        <div className="h-1.5 w-24 bg-white/10 rounded-full"/>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Cron Panel ───────────────────────────────────────────────────────────────
export function CronEngagementPanel() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [lastResult, setLastResult] = useState<any>(null)

    const loadLogs = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/cron/trigger')
            if (res.ok) { const data = await res.json(); setLogs(data.logs || []) }
        } finally { setLoading(false) }
    }, [])

    useEffect(() => { loadLogs() }, [loadLogs])

    const handleRun = async () => {
        setRunning(true); setLastResult(null)
        try {
            const res = await fetch('/api/admin/cron/trigger', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_only: true }),
            })
            const data = await res.json()
            setLastResult(data)
            await loadLogs()
        } catch (err: any) {
            setLastResult({ error: err.message })
        } finally { setRunning(false) }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                    <Bot size={20} className="text-indigo-400"/>
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-white text-sm mb-1">IA de Engajamento Automático</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">
                        Todo dia às <strong className="text-white">09:00 BRT</strong> a IA analisa cada paciente e envia mensagem personalizada no inbox — resgate para inativas, celebração para marcos de streak, dica para adesão baixa.
                    </p>
                    <div className="flex items-center gap-4 mt-2.5">
                        <span className="flex items-center gap-1 text-[10px] text-slate-500"><Clock size={11} className="text-indigo-400"/> Cron diário 09:00</span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500"><Bell size={11} className="text-indigo-400"/> Inbox + Push</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <button onClick={handleRun} disabled={running}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all rounded-xl text-white text-xs font-bold">
                        {running ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>}
                        {running ? 'Rodando...' : 'Executar agora'}
                    </button>
                    <button onClick={loadLogs} className="text-slate-600 hover:text-slate-400 transition-colors"><RefreshCw size={13}/></button>
                </div>
            </div>

            {/* Result */}
            <AnimatePresence>
                {lastResult && !lastResult.error && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
                        <CheckCircle size={16} className="text-emerald-400 flex-shrink-0"/>
                        <div>
                            <p className="text-xs font-bold text-white">Execução concluída</p>
                            <p className="text-[11px] text-slate-400">{lastResult.notifications_sent || 0} notificações · {lastResult.data?.elapsed_ms || 0}ms</p>
                        </div>
                    </motion.div>
                )}
                {lastResult?.error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
                        <XCircle size={16} className="text-rose-400 flex-shrink-0"/>
                        <p className="text-xs text-rose-300">{lastResult.error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Logic */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Regras de disparo</p>
                {[
                    { icon: '⚠️', label: 'Risco ALTO',    desc: 'Inativa > 7 dias → mensagem de resgate (Gemini)',     color: 'text-rose-400' },
                    { icon: '⚡', label: 'Risco MÉDIO',   desc: 'Adesão < 60% nos últimos 7 dias → dica motivacional', color: 'text-amber-400' },
                    { icon: '🔥', label: 'Marco de streak', desc: '7/14/21/30/60/100 dias → celebração personalizada', color: 'text-orange-400' },
                    { icon: '✅', label: 'Risco BAIXO',   desc: 'Sem marco ativo → nenhuma mensagem (sem spam)',       color: 'text-emerald-400' },
                ].map(item => (
                    <div key={item.label} className="flex items-start gap-2.5">
                        <span className="text-sm mt-0.5">{item.icon}</span>
                        <p className="text-xs"><span className={`font-bold ${item.color}`}>{item.label}</span><span className="text-slate-500"> — {item.desc}</span></p>
                    </div>
                ))}
            </div>

            {/* Log */}
            <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Histórico</p>
                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-600"/></div>
                ) : logs.length === 0 ? (
                    <p className="text-center text-slate-600 text-sm py-8">Nenhuma execução registrada.</p>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
                        {logs.map(log => (
                            <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                                <span className={`text-[10px] font-black uppercase flex items-center gap-1 w-20 flex-shrink-0
                                    ${log.status === 'success' ? 'text-emerald-400' : log.status === 'error' ? 'text-rose-400' : 'text-amber-400'}`}>
                                    {log.status === 'success' ? <><CheckCircle size={10}/> OK</> : log.status === 'error' ? <><XCircle size={10}/> ERRO</> : <><Loader2 size={10} className="animate-spin"/> …</>}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] text-slate-400">
                                        {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        {log.triggered_by === 'manual' && <span className="ml-2 text-[9px] bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">Manual</span>}
                                    </p>
                                    {log.error_message && <p className="text-[11px] text-rose-400 truncate">{log.error_message}</p>}
                                </div>
                                {log.status === 'success' && (
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-xs font-bold text-white">{log.notifications_sent || 0}</p>
                                        <p className="text-[9px] text-slate-600 uppercase">notifs</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function AISettingsView({ setView, tenantId }: { setView: (v: any) => void; tenantId?: string }) {
    const { tenant, updateTenant, loading: loadingTenant } = useTenant(tenantId)

    const [tab, setTab] = useState<'personalidade' | 'prompt' | 'cron'>('personalidade')
    const [tone, setTone] = useState<Tone>('acolhedora')
    const [emojiLevel, setEmojiLevel] = useState(2)
    const [methodName, setMethodName] = useState('')
    const [brandName, setBrandName] = useState('')
    const [systemPrompt, setSystemPrompt] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    useEffect(() => {
        if (tenant) {
            setMethodName(tenant.method_name || '')
            setBrandName(tenant.brand_name || '')
            setSystemPrompt(tenant.gpt_system_prompt || 'Você é uma nutricionista dedicada e empática. Use linguagem acessível, alimentos reais e foque na adesão de longo prazo.')
            const ai = tenant.settings?.ai || {}
            if (ai.tone) setTone(ai.tone)
            if (ai.emojiLevel) setEmojiLevel(ai.emojiLevel)
        }
    }, [tenant])

    const handleSave = async () => {
        if (!tenant) return
        setIsSaving(true)
        try {
            const { error } = await updateTenant(tenant.id, {
                name: brandName,
                method_name: methodName || undefined,
                gpt_system_prompt: systemPrompt,
                settings: {
                    ...tenant.settings,
                    ai: { tone, emojiLevel }
                }
            } as any)
            if (error) throw new Error(error)
            setToast({ type: 'success', msg: 'Configurações de IA salvas com sucesso!' })
        } catch (err: any) {
            setToast({ type: 'error', msg: 'Erro ao salvar: ' + err.message })
        } finally {
            setIsSaving(false)
        }
    }

    const charCount = systemPrompt.length
    const promptScore = charCount < 50 ? 'fraco' : charCount < 150 ? 'bom' : 'excelente'
    const promptScoreColor = { fraco: 'text-rose-400', bom: 'text-amber-400', excelente: 'text-emerald-400' }[promptScore]

    if (loadingTenant) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 size={28} className="animate-spin text-slate-600"/>
        </div>
    )

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">Laboratório de <span className="font-bold">Inteligência</span></h1>
                    <p className="text-slate-500 text-sm mt-0.5">Configure o comportamento e a personalidade da sua IA.</p>
                </div>
                {tab !== 'cron' && (
                    <button onClick={handleSave} disabled={isSaving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                        {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                        {isSaving ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                )}
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)}/>}
            </AnimatePresence>

            {/* Tabs */}
            <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1 w-fit">
                {([
                    ['personalidade', <MessageCircle size={13}/>, 'Personalidade'],
                    ['prompt',        <Edit3 size={13}/>,          'Prompt da IA'],
                    ['cron',          <Bot size={13}/>,             'IA 24h'],
                ] as const).map(([v, icon, l]) => (
                    <button key={v} onClick={() => setTab(v)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all
                            ${tab === v ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        {icon} {l}
                    </button>
                ))}
            </div>

            {/* ── Tab: Personalidade ─────────────────────────────────────── */}
            {tab === 'personalidade' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="space-y-5">
                        {/* Club identity */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Identidade do Clube</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 block">Nome do clube</label>
                                    <input value={brandName} onChange={e => setBrandName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                        placeholder="Ex: NutriClub da Ana"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 block">Nome do método</label>
                                    <input value={methodName} onChange={e => setMethodName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                        placeholder="Ex: Método NutriGenética 360º"/>
                                </div>
                            </div>
                        </div>

                        {/* Tone */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2"><MessageCircle size={12}/> Tom de Voz</p>
                            {TONE_OPTIONS.map(item => (
                                <motion.div key={item.id} whileHover={{ x: 3 }} onClick={() => setTone(item.id)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all
                                        ${tone === item.id ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-white/[0.02] border-white/5 hover:border-white/15'}`}>
                                    <div>
                                        <p className={`font-bold text-sm ${tone === item.id ? 'text-white' : 'text-slate-300'}`}>{item.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                                    </div>
                                    {tone === item.id && <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0"><Check size={11} className="text-white"/></div>}
                                </motion.div>
                            ))}
                        </div>

                        {/* Emoji slider */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2"><Sliders size={12}/> Intensidade de Emojis</p>
                                <span className={`text-xs font-bold ${emojiLevel === 1 ? 'text-slate-400' : emojiLevel === 2 ? 'text-indigo-400' : 'text-amber-400'}`}>
                                    {emojiLevel === 1 ? 'Discreta' : emojiLevel === 2 ? 'Moderada' : 'Expressiva'}
                                </span>
                            </div>
                            <input type="range" min="1" max="3" value={emojiLevel} onChange={e => setEmojiLevel(Number(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"/>
                            <div className="flex justify-between mt-2 text-[9px] text-slate-700 font-bold uppercase">
                                <span>Discreta</span><span>Moderada</span><span>Expressiva</span>
                            </div>
                        </div>

                        {/* Tip */}
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-4 py-3 flex items-start gap-2.5">
                            <Zap size={13} className="text-indigo-400 flex-shrink-0 mt-0.5"/>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                O tom <strong className="text-white">Acolhedor</strong> tende a aumentar a retenção em grupos de emagrecimento. A IA usa esse tom em todas as mensagens automáticas.
                            </p>
                        </div>
                    </div>

                    {/* Phone preview */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2"><Smartphone size={12}/> Preview em tempo real</p>
                        <PhonePreview tone={tone} brandName={brandName || tenant?.brand_name || 'Clube'}/>
                        <p className="text-center text-[10px] text-slate-700 uppercase tracking-widest">Assim sua IA fala com as rainhas</p>
                    </div>
                </div>
            )}

            {/* ── Tab: Prompt ────────────────────────────────────────────── */}
            {tab === 'prompt' && (
                <div className="max-w-3xl space-y-5">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                        <Sparkles size={14} className="text-amber-400 flex-shrink-0 mt-0.5"/>
                        <div>
                            <p className="text-xs font-bold text-amber-300 mb-1">Como funciona</p>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                O <strong className="text-white">prompt de sistema</strong> é a instrução base que molda todo o comportamento da IA — como ela responde nas análises de refeição, nos check-ins e nas mensagens de engajamento automático. Quanto mais específica e detalhada for a instrução, mais alinhada ao seu método a IA será.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Prompt de Sistema</p>
                            <span className={`text-[10px] font-black uppercase ${promptScoreColor}`}>
                                {charCount} chars — {promptScore}
                            </span>
                        </div>
                        <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none h-52 leading-relaxed"
                            placeholder="Descreva como a IA deve se comportar..."/>

                        {/* Quality meter */}
                        <div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${promptScore === 'fraco' ? 'bg-rose-500 w-1/5' : promptScore === 'bom' ? 'bg-amber-500 w-2/3' : 'bg-emerald-500 w-full'}`}/>
                            </div>
                        </div>
                    </div>

                    {/* Examples */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Exemplos de instruções eficazes</p>
                        {[
                            { label: 'Método Low Carb', text: 'Você é nutricionista especialista em low carb e jejum intermitente. Nunca recomende alimentos ultraprocessados. Priorize proteína animal de qualidade e gorduras boas. Seja direta e evite modismos.' },
                            { label: 'Abordagem Integrativa', text: 'Você é nutricionista integrativa focada em saúde intestinal e hormonal feminina. Sempre mencione a relação intestino-cérebro. Use linguagem científica acessível. Foque no ciclo menstrual quando relevante.' },
                            { label: 'Foco em Comportamento', text: 'Você é uma coach de nutrição focada em mudança de comportamento alimentar. Faça perguntas reflexivas antes de dar soluções. Evite dietas restritivas. Priorize construção de hábitos sustentáveis.' },
                        ].map(ex => (
                            <button key={ex.label} onClick={() => setSystemPrompt(ex.text)}
                                className="w-full text-left bg-white/[0.03] hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/25 rounded-xl px-4 py-3 transition-all group">
                                <p className="text-xs font-bold text-indigo-400 group-hover:text-indigo-300 mb-1">{ex.label}</p>
                                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{ex.text}</p>
                            </button>
                        ))}
                    </div>

                    {/* Preview */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2"><Eye size={11}/> Como a IA receberá sua instrução</p>
                        <div className="bg-slate-950 rounded-xl p-4 border border-white/5 font-mono text-xs text-slate-400 leading-relaxed">
                            <span className="text-indigo-400">SYSTEM:</span> {systemPrompt || <span className="text-slate-700 italic">Instrução não definida</span>}
                            <br/><br/>
                            <span className="text-indigo-400">CONTEXT:</span> <span className="text-slate-500">tom={tone}, emojis={['discreta','moderada','expressiva'][emojiLevel-1]}, clube={brandName || 'não definido'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tab: IA 24h ─────────────────────────────────────────────── */}
            {tab === 'cron' && (
                <div className="max-w-3xl">
                    <CronEngagementPanel/>
                </div>
            )}
        </div>
    )
}
