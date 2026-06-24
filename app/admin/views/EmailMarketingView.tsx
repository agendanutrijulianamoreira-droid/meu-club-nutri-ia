"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Mail, Send, Sparkles, Loader2, CheckCircle, Users, Crown,
    Flame, Clock, AlertTriangle, Eye, EyeOff, ChevronDown
} from "lucide-react"

interface Campaign {
    id: string
    title: string
    body: string
    status: string
    sent_at: string | null
    created_at: string
    channels: Record<string, boolean>
    segment: { type: string }
}

const SEGMENTS = [
    { value: 'all', label: 'Todas as pacientes', icon: Users, desc: 'Toda a base ativa' },
    { value: 'vip', label: 'Plano VIP', icon: Crown, desc: 'Somente membros VIP' },
    { value: 'active', label: 'Ativas (últimos 3 dias)', icon: Flame, desc: 'Engajadas recentemente' },
    { value: 'inactive', label: 'Inativas (7+ dias)', icon: AlertTriangle, desc: 'Sem check-in há uma semana' },
]

const SEGMENT_LABELS: Record<string, string> = {
    all: 'Todas', vip: 'VIP', active: 'Ativas', inactive: 'Inativas',
}

const TEMPLATES = [
    {
        label: 'Motivação semanal',
        subject: '✨ Sua semana começa agora, Rainha!',
        body: `<p>Olá, <strong>Rainha!</strong></p>
<p>Uma nova semana está chegando cheia de oportunidades para você brilhar. Cada escolha saudável que você faz é uma vitória — por menor que pareça.</p>
<p>🥗 Foque na sua alimentação hoje.<br>💧 Lembre-se de se hidratar.<br>🏃‍♀️ Mova seu corpo com amor.</p>
<p>Estamos juntas nessa jornada. 💜</p>`,
    },
    {
        label: 'Lembrete de check-in',
        subject: '📝 Não esqueça do seu check-in semanal!',
        body: `<p>Oi, <strong>Rainha!</strong></p>
<p>Seu check-in semanal está esperando por você! É só alguns minutos para registrar como foi sua semana — e cada registro traz pontos, insights e o olhar atento da sua nutricionista.</p>
<p>✅ Entre no app agora e compartilhe como está indo.<br>💡 Suas respostas ajudam a personalizar ainda mais o seu protocolo.</p>`,
    },
    {
        label: 'Promo VIP',
        subject: '👑 Uma oportunidade especial para você',
        body: `<p>Olá, <strong>Rainha!</strong></p>
<p>Você tem se dedicado muito e merece o melhor suporte possível. O <strong>Plano VIP</strong> foi feito para quem quer resultados acelerados com acompanhamento personalizado.</p>
<p>🔥 Benefícios exclusivos:<br>• Atendimento prioritário<br>• Conteúdos premium<br>• Suporte ilimitado da IA</p>
<p>Quer saber mais? Acesse o app e conheça o Plano VIP. 👑</p>`,
    },
]

function htmlToPreview(html: string) {
    return html.replace(/<p>/g, '').replace(/<\/p>/g, '\n\n').replace(/<br\s*\/?>/g, '\n')
        .replace(/<strong>(.*?)<\/strong>/g, '**$1**').replace(/<[^>]*>/g, '').trim()
}

export function EmailMarketingView({ tenantId = '' }: { setView?: (v: any) => void; tenantId?: string }) {
    const [subject, setSubject] = useState('')
    const [htmlBody, setHtmlBody] = useState('')
    const [segment, setSegment] = useState('all')
    const [sending, setSending] = useState(false)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiTopic, setAiTopic] = useState('')
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [hasResend, setHasResend] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [showTemplates, setShowTemplates] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [segmentOpen, setSegmentOpen] = useState(false)

    useEffect(() => {
        fetch('/api/admin/email-campaign')
            .then(r => r.json())
            .then(d => { setCampaigns(d.campaigns || []); setHasResend(d.has_resend) })
    }, [])

    const showToast = (type: 'success' | 'error' | 'info', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 4000)
    }

    const applyTemplate = (t: typeof TEMPLATES[0]) => {
        setSubject(t.subject)
        setHtmlBody(t.body)
        setShowTemplates(false)
    }

    const generateWithAI = async () => {
        if (!aiTopic.trim()) return
        setAiLoading(true)
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task: 'email-marketing', topic: aiTopic, segment }),
            })
            const data = await res.json()
            if (data.subject) setSubject(data.subject)
            if (data.html_body) setHtmlBody(data.html_body)
            setAiTopic('')
        } catch {
            showToast('error', 'Erro ao gerar com IA')
        } finally {
            setAiLoading(false) }
    }

    const handleSend = async () => {
        setSending(true)
        setShowConfirm(false)
        try {
            const res = await fetch('/api/admin/email-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, html_body: htmlBody, segment }),
            })
            const data = await res.json()
            if (res.ok) {
                if (data.simulated) {
                    showToast('info', `Simulado: ${data.count} email(s) — adicione RESEND_API_KEY para envio real`)
                } else {
                    showToast('success', `${data.count} email(s) enviado(s) com sucesso!`)
                }
                setSubject('')
                setHtmlBody('')
                // Refresh history
                const updated = await fetch('/api/admin/email-campaign').then(r => r.json())
                setCampaigns(updated.campaigns || [])
            } else {
                showToast('error', data.error || 'Erro ao enviar')
            }
        } finally {
            setSending(false)
        }
    }

    const selectedSegment = SEGMENTS.find(s => s.value === segment) || SEGMENTS[0]
    const canSend = subject.trim() && htmlBody.trim()

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">Email <span className="font-bold">Marketing</span></h1>
                    <p className="text-slate-500 text-sm mt-1">Envie campanhas de email para suas pacientes</p>
                </div>
                {!hasResend && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <AlertTriangle size={13} className="text-amber-400"/>
                        <span className="text-[11px] text-amber-400 font-bold">Modo simulação — configure RESEND_API_KEY</span>
                    </div>
                )}
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`px-4 py-3 rounded-2xl text-sm font-bold border ${
                            toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : toast.type === 'info' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-[1fr_340px] gap-5">
                {/* ── Left: Composer ── */}
                <div className="space-y-4">
                    {/* AI Generator */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Sparkles size={11}/> Gerar com IA
                        </p>
                        <div className="flex gap-2">
                            <input
                                value={aiTopic}
                                onChange={e => setAiTopic(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && generateWithAI()}
                                placeholder="Ex: motivar para check-in da semana, promoção VIP, dica de hidratação..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                            />
                            <button onClick={generateWithAI} disabled={aiLoading || !aiTopic.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all">
                                {aiLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                                Gerar
                            </button>
                        </div>
                    </div>

                    {/* Composer */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Mail size={11}/> Composição
                            </p>
                            <button onClick={() => setShowTemplates(!showTemplates)}
                                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                Templates <ChevronDown size={10} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`}/>
                            </button>
                        </div>

                        <AnimatePresence>
                            {showTemplates && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden">
                                    <div className="grid grid-cols-3 gap-2 pb-2">
                                        {TEMPLATES.map(t => (
                                            <button key={t.label} onClick={() => applyTemplate(t)}
                                                className="p-3 bg-white/5 border border-white/10 hover:border-indigo-500/30 rounded-xl text-left transition-all group">
                                                <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">{t.label}</p>
                                                <p className="text-[10px] text-slate-600 mt-1 line-clamp-2">{t.subject}</p>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assunto</label>
                            <input
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                placeholder="Ex: ✨ Sua semana começa agora, Rainha!"
                                className="w-full mt-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Corpo do Email (HTML permitido)</label>
                                <button onClick={() => setShowPreview(!showPreview)}
                                    className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
                                    {showPreview ? <EyeOff size={10}/> : <Eye size={10}/>}
                                    {showPreview ? 'Editar' : 'Preview'}
                                </button>
                            </div>
                            {showPreview ? (
                                <div className="bg-white text-slate-900 rounded-xl p-4 text-sm min-h-[200px]"
                                    dangerouslySetInnerHTML={{ __html: htmlBody || '<p class="text-gray-400">Nenhum conteúdo ainda</p>' }}/>
                            ) : (
                                <textarea
                                    value={htmlBody}
                                    onChange={e => setHtmlBody(e.target.value)}
                                    rows={10}
                                    placeholder="<p>Olá, <strong>Rainha!</strong></p><p>Sua mensagem aqui...</p>"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 font-mono resize-none"
                                />
                            )}
                        </div>

                        {/* Segment selector */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Segmento</label>
                            <div className="relative mt-1.5">
                                <button onClick={() => setSegmentOpen(!segmentOpen)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-left flex items-center gap-3 hover:border-indigo-500/50 transition-all">
                                    <selectedSegment.icon size={15} className="text-slate-400 flex-shrink-0"/>
                                    <div className="flex-1">
                                        <span className="text-white font-bold">{selectedSegment.label}</span>
                                        <span className="text-slate-500 text-[11px] ml-2">{selectedSegment.desc}</span>
                                    </div>
                                    <ChevronDown size={14} className={`text-slate-500 transition-transform ${segmentOpen ? 'rotate-180' : ''}`}/>
                                </button>
                                <AnimatePresence>
                                    {segmentOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setSegmentOpen(false)}/>
                                            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                                                className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20">
                                                {SEGMENTS.map(s => (
                                                    <button key={s.value} onClick={() => { setSegment(s.value); setSegmentOpen(false) }}
                                                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-all hover:bg-white/5 ${segment === s.value ? 'bg-indigo-500/10' : ''}`}>
                                                        <s.icon size={15} className="text-slate-400 flex-shrink-0"/>
                                                        <div>
                                                            <p className={`font-bold ${segment === s.value ? 'text-indigo-300' : 'text-white'}`}>{s.label}</p>
                                                            <p className="text-[10px] text-slate-500">{s.desc}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={!canSend || sending}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-2xl transition-all">
                            {sending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                            {sending ? 'Enviando...' : `Enviar para ${selectedSegment.label}`}
                        </button>
                    </div>
                </div>

                {/* ── Right: History ── */}
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Clock size={11}/> Histórico de Envios
                    </p>

                    {!hasResend && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
                            <p className="text-xs font-bold text-amber-300">Configurar envio real</p>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                Adicione <code className="text-amber-300 bg-white/5 px-1 rounded">RESEND_API_KEY</code> nas variáveis de ambiente do Vercel para enviar emails reais via <strong>Resend</strong> (gratuito até 3.000/mês).
                            </p>
                            <a href="https://resend.com/signup" target="_blank" rel="noopener"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors">
                                Criar conta gratuita →
                            </a>
                        </div>
                    )}

                    {campaigns.length === 0 ? (
                        <div className="text-center py-10 text-slate-700">
                            <Mail size={32} className="mx-auto mb-3 opacity-30"/>
                            <p className="text-sm">Nenhuma campanha enviada ainda</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {campaigns.map(c => (
                                <div key={c.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-bold text-white leading-tight line-clamp-2">{c.title}</p>
                                        <span className={`flex-shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                            c.status === 'sent' ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                                            : c.status === 'failed' ? 'bg-rose-500/15 border-rose-500/25 text-rose-400'
                                            : 'bg-amber-500/15 border-amber-500/25 text-amber-400'}`}>
                                            {c.status === 'sent' ? 'Enviado' : c.status === 'failed' ? 'Falhou' : c.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-600">
                                        <span className="flex items-center gap-1">
                                            <Users size={9}/> {SEGMENT_LABELS[c.segment?.type] || c.segment?.type}
                                        </span>
                                        {c.sent_at && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={9}/> {new Date(c.sent_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Confirm Modal */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                            className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                                    <Send size={18} className="text-indigo-400"/>
                                </div>
                                <div>
                                    <p className="font-bold text-white">Confirmar disparo</p>
                                    <p className="text-xs text-slate-500">{selectedSegment.label}</p>
                                </div>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Assunto</span>
                                    <span className="text-white font-bold truncate max-w-[180px]">{subject}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Segmento</span>
                                    <span className="text-white font-bold">{selectedSegment.label}</span>
                                </div>
                                {!hasResend && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <AlertTriangle size={12} className="text-amber-400 flex-shrink-0"/>
                                        <span className="text-[11px] text-amber-400">Será simulado (sem RESEND_API_KEY)</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowConfirm(false)}
                                    className="flex-1 py-3 bg-white/5 border border-white/10 text-slate-400 text-sm font-bold rounded-2xl">
                                    Cancelar
                                </button>
                                <button onClick={handleSend}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
                                    <Send size={14}/> Disparar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
