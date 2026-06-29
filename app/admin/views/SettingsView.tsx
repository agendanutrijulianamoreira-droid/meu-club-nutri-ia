"use client"

import { useState, useEffect } from "react"
import {
    Save, Palette, Image as ImageIcon, Globe, Bell, Shield,
    Loader2, Copy, Check, ExternalLink, CreditCard, ChevronRight,
    ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, X,
    Download, Trash2, RefreshCw, Link2, Lock, Building2
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useTenant } from "@/lib/hooks/useDatabase"
import { useStorage } from "@/lib/hooks/useStorage"
import { getTenantPlans, saveTenantPlan } from "@/app/admin/actions/checkoutActions"

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button onClick={onToggle}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-emerald-600' : 'bg-white/10'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-0.5'}`}/>
        </button>
    )
}

function Section({ title, icon, children, className = '' }: {
    title?: string; icon?: React.ReactNode; children?: React.ReactNode; className?: string
}) {
    return (
        <div className={`bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4 ${className}`}>
            {(title || icon) && (
                <div className="flex items-center gap-2">
                    {icon && <span className="text-slate-400">{icon}</span>}
                    {title && <p className="text-sm font-bold text-white">{title}</p>}
                </div>
            )}
            {children}
        </div>
    )
}

function Toast({ type, msg, onClose }: { type: 'success' | 'error'; msg: string; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold
                ${type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-rose-500/10 border-rose-500/25 text-rose-400'}`}>
            {type === 'success' ? <CheckCircle size={13}/> : <AlertTriangle size={13}/>}
            <span>{msg}</span>
            <button onClick={onClose} className="ml-auto opacity-60 hover:opacity-100"><X size={11}/></button>
        </motion.div>
    )
}

const PLAN_META: Record<string, { label: string; color: string; bg: string }> = {
    free:         { label: 'Free',         color: 'text-slate-400',   bg: 'bg-slate-500/15 border-slate-500/25' },
    professional: { label: 'Professional', color: 'text-indigo-400',  bg: 'bg-indigo-500/15 border-indigo-500/25' },
    premium:      { label: 'Premium',      color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/25' },
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function SettingsView({ setView, tenantId }: { setView: (v: any) => void; tenantId?: string }) {
    const { tenant, updateTenant, loading } = useTenant(tenantId)
    const { uploadImage, uploading: uploadingLogo } = useStorage()

    const [tab, setTab] = useState<'clube' | 'notificacoes' | 'avancado'>('clube')
    const [clubName, setClubName] = useState('')
    const [brandColor, setBrandColor] = useState('#6366f1')
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [notifications, setNotifications] = useState({
        inactive_queens: true,
        achievements: true,
        daily_summary: false,
    })
    const [isSaving, setIsSaving] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const [copied, setCopied] = useState<'slug' | 'id' | null>(null)
    const [dangerAction, setDangerAction] = useState<string | null>(null)

    // Plan pricing state
    const [planPrices, setPlanPrices] = useState<Record<string, { price_cents: number; stripe_price_id: string; description: string }>>({
        tech_diet: { price_cents: 9700, stripe_price_id: '', description: '' },
        vip: { price_cents: 19700, stripe_price_id: '', description: '' },
    })
    const [savingPlan, setSavingPlan] = useState<string | null>(null)

    useEffect(() => {
        if (tenant?.id) {
            getTenantPlans(tenant.id).then(({ plans }) => {
                if (plans.length > 0) {
                    const map: typeof planPrices = { ...planPrices }
                    plans.forEach((p: any) => {
                        if (p.plan === 'tech_diet' || p.plan === 'vip') {
                            map[p.plan] = {
                                price_cents: p.price_cents || 0,
                                stripe_price_id: p.stripe_price_id || '',
                                description: p.description || '',
                            }
                        }
                    })
                    setPlanPrices(map)
                }
            })
        }
    }, [tenant?.id])

    const handleSavePlan = async (plan: 'tech_diet' | 'vip') => {
        if (!tenantId) return
        setSavingPlan(plan)
        const { error } = await saveTenantPlan({
            tenantId,
            plan,
            priceCents: planPrices[plan].price_cents,
            stripePriceId: planPrices[plan].stripe_price_id || undefined,
            description: planPrices[plan].description || undefined,
        })
        setSavingPlan(null)
        if (error) showToast('error', 'Erro: ' + error)
        else showToast('success', `Plano ${plan === 'tech_diet' ? 'Tech Diet' : 'VIP'} salvo!`)
    }

    useEffect(() => {
        if (tenant) {
            setClubName(tenant.brand_name || '')
            setBrandColor(tenant.brand_color || '#6366f1')
            setLogoUrl(tenant.logo_url)
            if (tenant.settings?.notifications) {
                setNotifications(prev => ({ ...prev, ...tenant.settings.notifications }))
            }
        }
    }, [tenant])

    const showToast = (type: 'success' | 'error', msg: string) => setToast({ type, msg })

    const handleSave = async () => {
        if (!tenant) return
        setIsSaving(true)
        try {
            const { error } = await updateTenant(tenant.id, {
                brand_name: clubName,
                brand_color: brandColor,
                logo_url: logoUrl,
                settings: { ...(tenant.settings || {}), notifications },
            })
            if (error) throw new Error(error)
            showToast('success', 'Configurações salvas com sucesso!')
        } catch (err: any) {
            showToast('error', 'Erro ao salvar: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const { url, error } = await uploadImage(file, 'logos')
        if (error) showToast('error', 'Erro ao subir logo: ' + error)
        else setLogoUrl(url)
    }

    const copyText = (text: string, field: 'slug' | 'id') => {
        navigator.clipboard.writeText(text)
        setCopied(field)
        setTimeout(() => setCopied(null), 2000)
    }

    const handleDangerAction = async (action: string) => {
        if (!confirm(
            action === 'reset-ranking'
                ? 'Isso zerará os pontos de XP de TODAS as rainhas. Confirmar?'
                : 'Exportar todos os dados do clube. Continuar?'
        )) return

        setDangerAction(action)
        await new Promise(r => setTimeout(r, 1200)) // placeholder - real API calls would go here
        setDangerAction(null)
        showToast('success', action === 'reset-ranking' ? 'Ranking resetado.' : 'Exportação iniciada, verifique seu e-mail.')
    }

    const planMeta = PLAN_META[tenant?.plan_tier || 'free'] || PLAN_META.free

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 size={28} className="animate-spin text-slate-600"/>
        </div>
    )

    return (
        <div className="space-y-5 max-w-2xl pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">Configurações <span className="font-bold">do Clube</span></h1>
                    <p className="text-slate-500 text-sm mt-0.5">Identidade, notificações e opções avançadas.</p>
                </div>
                {tab !== 'avancado' && (
                    <button onClick={handleSave} disabled={isSaving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                        {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                        {isSaving ? 'Salvando…' : 'Salvar'}
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
                    ['clube',        <Building2 size={13}/>, 'Clube'],
                    ['notificacoes', <Bell size={13}/>,       'Notificações'],
                    ['avancado',     <Shield size={13}/>,     'Avançado'],
                ] as const).map(([v, icon, l]) => (
                    <button key={v} onClick={() => setTab(v)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all
                            ${tab === v ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        {icon} {l}
                    </button>
                ))}
            </div>

            {/* ── Tab: Clube ────────────────────────────────────────────────── */}
            {tab === 'clube' && (
                <div className="space-y-4">
                    {/* Club info */}
                    <Section title="Identidade Visual" icon={<Globe size={15}/>}>
                        {/* Logo */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Logo do Clube</label>
                            <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={handleLogoUpload}/>
                            <div onClick={() => document.getElementById('logo-upload')?.click()}
                                className="border border-dashed border-white/15 rounded-2xl p-5 text-center cursor-pointer hover:border-indigo-500/40 transition-all group">
                                {uploadingLogo ? (
                                    <div className="flex items-center justify-center gap-2 py-2">
                                        <Loader2 size={16} className="animate-spin text-indigo-400"/>
                                        <span className="text-xs text-slate-400">Enviando…</span>
                                    </div>
                                ) : logoUrl ? (
                                    <div className="relative group/logo">
                                        <img src={logoUrl} alt="Logo" className="h-16 mx-auto rounded-xl object-contain"/>
                                        <p className="text-[10px] text-slate-600 mt-2 group-hover/logo:text-slate-400 transition-colors">Clique para alterar</p>
                                    </div>
                                ) : (
                                    <div className="py-3 flex items-center justify-center gap-2 text-slate-600 group-hover:text-slate-400 transition-colors">
                                        <ImageIcon size={16}/>
                                        <span className="text-xs font-bold">PNG ou SVG, máx 2MB</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Club name */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Nome do Clube</label>
                            <input value={clubName} onChange={e => setClubName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                placeholder="Ex: NutriClub da Ana"/>
                        </div>

                        {/* Brand color */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Cor Principal</label>
                            <div className="flex items-center gap-3">
                                <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                                    className="h-11 w-16 rounded-xl cursor-pointer border-0 bg-transparent"/>
                                <input value={brandColor} onChange={e => setBrandColor(e.target.value)}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-indigo-500/50"
                                    placeholder="#6366f1"/>
                                <div className="w-11 h-11 rounded-xl border border-white/10 flex-shrink-0"
                                    style={{ backgroundColor: brandColor }}/>
                            </div>
                        </div>
                    </Section>

                    {/* Login page editor link */}
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-indigo-300">Editor da Página de Login</p>
                            <p className="text-xs text-slate-500 mt-0.5">Personalize headline, bullets e imagem de fundo</p>
                        </div>
                        <button onClick={() => setView('settings-login')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all">
                            <Palette size={12}/> Abrir editor <ChevronRight size={11}/>
                        </button>
                    </div>

                    {/* Tenant info (read-only) */}
                    <Section title="Informações do Clube" icon={<Link2 size={15}/>}>
                        {/* Slug */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">URL do Clube</label>
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                <span className="text-xs text-slate-500 font-mono">/vender/</span>
                                <span className="text-xs text-white font-mono flex-1">{tenant?.slug || '—'}</span>
                                <button onClick={() => tenant?.slug && copyText(`${typeof window !== 'undefined' ? window.location.origin : ''}/vender/${tenant.slug}`, 'slug')}
                                    className="text-slate-600 hover:text-indigo-400 transition-colors flex-shrink-0">
                                    {copied === 'slug' ? <Check size={13} className="text-emerald-400"/> : <Copy size={13}/>}
                                </button>
                                {tenant?.slug && (
                                    <a href={`/vender/${tenant.slug}`} target="_blank" rel="noopener"
                                        className="text-slate-600 hover:text-indigo-400 transition-colors flex-shrink-0">
                                        <ExternalLink size={13}/>
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Plan */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-white">Plano atual</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Seu plano define os limites do clube</p>
                            </div>
                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${planMeta.bg} ${planMeta.color}`}>
                                {planMeta.label}
                            </span>
                        </div>

                        {/* Tenant ID */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">ID do Clube</label>
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                                <span className="text-xs text-slate-600 font-mono flex-1 truncate">{tenantId || '—'}</span>
                                <button onClick={() => tenantId && copyText(tenantId, 'id')}
                                    className="text-slate-600 hover:text-indigo-400 transition-colors flex-shrink-0">
                                    {copied === 'id' ? <Check size={13} className="text-emerald-400"/> : <Copy size={13}/>}
                                </button>
                            </div>
                        </div>
                    </Section>

                    {/* Plan Pricing */}
                    <Section title="Preços dos Planos" icon={<CreditCard size={15}/>}>
                        <p className="text-xs text-slate-500 leading-relaxed -mt-1">
                            Configure os preços que suas alunas verão ao assinar. O Stripe Price ID é opcional — se informado, usa o preço configurado no Stripe.
                        </p>
                        {(['tech_diet', 'vip'] as const).map(plan => (
                            <div key={plan} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-black text-white uppercase tracking-wider">
                                            {plan === 'tech_diet' ? 'Tech Diet' : 'VIP Premium'}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            {plan === 'tech_diet' ? 'Plano principal com IA e gamificação' : 'Plano premium com suporte VIP'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleSavePlan(plan)}
                                        disabled={savingPlan === plan}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
                                    >
                                        {savingPlan === plan ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                                        Salvar
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                            Preço mensal (R$)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={(planPrices[plan].price_cents / 100).toFixed(2)}
                                            onChange={e => setPlanPrices(prev => ({
                                                ...prev,
                                                [plan]: { ...prev[plan], price_cents: Math.round(parseFloat(e.target.value || '0') * 100) }
                                            }))}
                                            className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                            Stripe Price ID
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="price_xxx (opcional)"
                                            value={planPrices[plan].stripe_price_id}
                                            onChange={e => setPlanPrices(prev => ({
                                                ...prev,
                                                [plan]: { ...prev[plan], stripe_price_id: e.target.value }
                                            }))}
                                            className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors font-mono"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                        Descrição (aparece no checkout)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Acesso completo ao método Tech Diet por 30 dias"
                                        value={planPrices[plan].description}
                                        onChange={e => setPlanPrices(prev => ({
                                            ...prev,
                                            [plan]: { ...prev[plan], description: e.target.value }
                                        }))}
                                        className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                                    />
                                </div>
                            </div>
                        ))}
                    </Section>
                </div>
            )}

            {/* ── Tab: Notificações ──────────────────────────────────────── */}
            {tab === 'notificacoes' && (
                <div className="space-y-4">
                    <Section title="Automações de Notificação" icon={<Bell size={15}/>}>
                        {[
                            { key: 'inactive_queens' as const,  label: 'Resgatar rainhas inativas',  desc: 'Dispara mensagem após 3 dias sem check-in' },
                            { key: 'achievements' as const,     label: 'Celebrar conquistas',         desc: 'Notifica ao ganhar badge ou milestone de streak' },
                            { key: 'daily_summary' as const,    label: 'Resumo diário por e-mail',    desc: 'Relatório com métricas do dia para o admin' },
                        ].map(item => (
                            <div key={item.key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                <div>
                                    <p className="text-sm font-bold text-white">{item.label}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                                </div>
                                <Toggle on={notifications[item.key]}
                                    onToggle={() => setNotifications(n => ({ ...n, [item.key]: !n[item.key] }))}/>
                            </div>
                        ))}
                    </Section>

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-3">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            💡 As automações de notificação funcionam em conjunto com a IA de Engajamento 24h.
                            Configure os detalhes no <button onClick={() => setView('ai-brain')} className="text-indigo-400 hover:text-indigo-300 font-bold underline">Laboratório de Inteligência</button>.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Tab: Avançado ──────────────────────────────────────────── */}
            {tab === 'avancado' && (
                <div className="space-y-4">
                    <Section className="border-rose-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={15} className="text-rose-400"/>
                            <p className="text-sm font-bold text-rose-400">Zona de Perigo</p>
                        </div>
                        <p className="text-xs text-slate-500">Ações irreversíveis. Confirme antes de prosseguir.</p>

                        <div className="space-y-3 pt-1">
                            {/* Export */}
                            <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                                <div>
                                    <p className="text-sm font-bold text-white">Exportar Dados</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Baixar CSV com todos os dados das rainhas</p>
                                </div>
                                <button onClick={() => handleDangerAction('export')}
                                    disabled={dangerAction === 'export'}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50">
                                    {dangerAction === 'export' ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>}
                                    Exportar
                                </button>
                            </div>

                            {/* Reset ranking */}
                            <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                                <div>
                                    <p className="text-sm font-bold text-white">Resetar Ranking</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Zerar XP e posições de todas as rainhas</p>
                                </div>
                                <button onClick={() => handleDangerAction('reset-ranking')}
                                    disabled={dangerAction === 'reset-ranking'}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50">
                                    {dangerAction === 'reset-ranking' ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
                                    Resetar
                                </button>
                            </div>

                            {/* Security info */}
                            <div className="flex items-start gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                                <Lock size={14} className="text-slate-500 flex-shrink-0 mt-0.5"/>
                                <div>
                                    <p className="text-sm font-bold text-white">Alterar Senha</p>
                                    <p className="text-xs text-slate-500 mt-0.5 mb-3">
                                        A troca de senha é feita diretamente pelo Supabase Auth.
                                    </p>
                                    <a href="https://supabase.com" target="_blank" rel="noopener"
                                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                                        Acessar painel de autenticação <ExternalLink size={11}/>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </Section>
                </div>
            )}
        </div>
    )
}
