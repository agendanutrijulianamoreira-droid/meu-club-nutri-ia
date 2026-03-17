"use client"

import { useState, useEffect, useCallback } from "react"
import { Save, Palette, Image, Type, CreditCard, Bell, Shield, Globe, Loader2, ExternalLink, CheckCircle2, XCircle, TrendingUp, Users, DollarSign, RefreshCw, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTenant } from "@/lib/hooks/useDatabase"
import { useStorage } from "@/lib/hooks/useStorage"

interface BillingData {
    tenant_id: string
    stripe_connected: boolean
    summary: {
        active_subscribers: number
        total_subscriptions: number
        mrr_cents: number
        mrr_brl: number
        status_counts: Record<string, number>
    }
    plan_breakdown: Array<{
        plan: string
        label: string
        count: number
        revenue_cents: number
    }>
    recent_events: Array<{
        id: string
        user_id: string
        plan: string
        plan_label: string
        status: string
        gateway: string
        amount_cents: number
        cancel_at_period_end: boolean
        current_period_end: string | null
        updated_at: string
        created_at: string
    }>
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    active: { label: 'Ativo', color: 'text-green-400 bg-green-400/10' },
    trialing: { label: 'Trial', color: 'text-blue-400 bg-blue-400/10' },
    past_due: { label: 'Vencida', color: 'text-yellow-400 bg-yellow-400/10' },
    cancelled: { label: 'Cancelada', color: 'text-red-400 bg-red-400/10' },
    pending: { label: 'Pendente', color: 'text-slate-400 bg-slate-400/10' },
}

export function SettingsView({ setView, tenantId }: { setView: (v: any) => void, tenantId?: string }) {
    const { tenant, updateTenant, loading } = useTenant(tenantId);
    const { uploadImage, uploading: isUploadingFile } = useStorage()
    const [clubName, setClubName] = useState("Clube da Nutri")
    const [brandColor, setBrandColor] = useState("#EC4899")
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [notifications, setNotifications] = useState({
        inactive_queens: true,
        achievements: true,
        daily_summary: false
    })
    const [saved, setSaved] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Billing state
    const [billing, setBilling] = useState<BillingData | null>(null)
    const [billingLoading, setBillingLoading] = useState(true)
    const [billingError, setBillingError] = useState<string | null>(null)
    const [portalLoading, setPortalLoading] = useState(false)

    // Export state
    const [isExporting, setIsExporting] = useState(false)
    const [exportToast, setExportToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    const fetchBilling = useCallback(async () => {
        setBillingLoading(true)
        setBillingError(null)
        try {
            const res = await fetch('/api/admin/billing')
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Erro ao carregar dados de faturamento')
            }
            const data: BillingData = await res.json()
            setBilling(data)
        } catch (err: any) {
            setBillingError(err.message)
        } finally {
            setBillingLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchBilling()
    }, [fetchBilling])

    // Sync state with tenant data
    useEffect(() => {
        if (tenant) {
            setClubName(tenant.name || "Clube da Nutri");
            setBrandColor(tenant.brand_color || "#EC4899");
            setLogoUrl(tenant.logo_url);
            if (tenant.settings?.notifications) {
                setNotifications(prev => ({ ...prev, ...tenant.settings.notifications }));
            }
        }
    }, [tenant]);

    const handleSave = async () => {
        if (!tenant) return;

        setIsSaving(true);
        try {
            const { error } = await updateTenant(tenant.id, {
                name: clubName,
                brand_color: brandColor,
                logo_url: logoUrl,
                settings: {
                    ...(tenant.settings || {}),
                    notifications: notifications
                }
            });

            if (error) throw new Error(error);

            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err: any) {
            alert("Erro ao salvar: " + err.message);
        } finally {
            setIsSaving(false);
        }
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const { url, error } = await uploadImage(file, 'logos')
        if (error) {
            alert("Erro ao subir logo: " + error)
        } else {
            setLogoUrl(url)
        }
    }

    const handleExportPatients = async () => {
        setIsExporting(true)
        setExportToast(null)
        try {
            const res = await fetch('/api/admin/export/patients')
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Erro ao exportar dados')
            }
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const disposition = res.headers.get('Content-Disposition')
            const filenameMatch = disposition?.match(/filename="(.+)"/)
            a.download = filenameMatch?.[1] || `pacientes-export-${new Date().toISOString().split('T')[0]}.csv`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
            setExportToast({ type: 'success', message: 'Dados exportados com sucesso!' })
            setTimeout(() => setExportToast(null), 3000)
        } catch (err: any) {
            setExportToast({ type: 'error', message: err.message || 'Erro ao exportar' })
            setTimeout(() => setExportToast(null), 4000)
        } finally {
            setIsExporting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-queen-pink" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Configurações ⚙️</h1>
                    <p className="text-gray-400 mt-1">Personalize seu Reino.</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`transition-all ${saved ? 'bg-green-600' : 'bg-gradient-to-r from-queen-pink to-purple-600'} border-0 min-w-[160px]`}
                >
                    {isSaving ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    {saved ? '✓ Salvo!' : isSaving ? 'Salvando...' : <><Save size={18} className="mr-2" /> Salvar Alterações</>}
                </Button>
            </div>

            {/* Settings Sections */}
            <div className="space-y-6">
                {/* Club Identity */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                    <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
                        <Globe size={20} className="text-queen-pink" />
                        Identidade do Clube
                    </h2>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
                            <div>
                                <h3 className="font-bold text-indigo-400">Design da Página de Login</h3>
                                <p className="text-sm text-slate-500">Personalize o visual e a copy da sua landing page.</p>
                            </div>
                            <Button
                                onClick={() => setView('settings-login')}
                                className="bg-indigo-600 hover:bg-indigo-500 h-12 rounded-xl text-xs font-black uppercase tracking-widest gap-2"
                            >
                                <Palette size={16} /> Abrir Editor
                            </Button>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">Nome do Clube</label>
                            <input
                                type="text"
                                value={clubName}
                                onChange={e => setClubName(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-queen-pink"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">Cor Principal</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="color"
                                    value={brandColor}
                                    onChange={e => setBrandColor(e.target.value)}
                                    className="h-12 w-20 rounded-lg cursor-pointer border-0"
                                />
                                <input
                                    type="text"
                                    value={brandColor}
                                    onChange={e => setBrandColor(e.target.value)}
                                    className="flex-1 bg-black/20 border border-white/10 rounded-xl p-4 text-white font-mono focus:outline-none focus:border-queen-pink"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">Logo do Clube</label>
                            <input
                                type="file"
                                id="logo-upload"
                                className="hidden"
                                accept="image/*"
                                onChange={handleLogoUpload}
                            />
                            <div
                                onClick={() => document.getElementById('logo-upload')?.click()}
                                className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-queen-pink/50 transition-colors cursor-pointer relative overflow-hidden group"
                            >
                                {isUploadingFile ? (
                                    <div className="flex flex-col items-center">
                                        <Loader2 className="animate-spin text-queen-pink mb-2" size={32} />
                                        <p className="text-sm text-gray-400">Subindo imagem...</p>
                                    </div>
                                ) : logoUrl ? (
                                    <div className="relative group/logo">
                                        <img src={logoUrl} alt="Logo preview" className="h-24 mx-auto rounded-lg object-contain" />
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity rounded-lg">
                                            <p className="text-xs font-bold text-white uppercase">Alterar Logo</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Image size={32} className="mx-auto text-gray-500 mb-2" />
                                        <p className="text-sm text-gray-400">Clique para enviar ou arraste a imagem</p>
                                        <p className="text-xs text-gray-600 mt-1">PNG ou SVG, máx 2MB</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                    <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
                        <Bell size={20} className="text-yellow-500" />
                        Notificações
                    </h2>

                    <div className="space-y-4">
                        <ToggleSetting
                            label="Notificar Rainhas inativas"
                            description="Enviar lembrete após 3 dias sem check-in"
                            enabled={notifications.inactive_queens}
                            onToggle={() => setNotifications(n => ({ ...n, inactive_queens: !n.inactive_queens }))}
                        />
                        <ToggleSetting
                            label="Celebrar conquistas"
                            description="Notificar quando alguém ganhar um badge"
                            enabled={notifications.achievements}
                            onToggle={() => setNotifications(n => ({ ...n, achievements: !n.achievements }))}
                        />
                        <ToggleSetting
                            label="Resumo diário"
                            description="Receber email com métricas do dia"
                            enabled={notifications.daily_summary}
                            onToggle={() => setNotifications(n => ({ ...n, daily_summary: !n.daily_summary }))}
                        />
                    </div>
                </div>

                {/* Billing Dashboard */}
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-lg flex items-center gap-2 text-white">
                            <CreditCard size={20} className="text-green-500" />
                            Pagamentos
                        </h2>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchBilling}
                                disabled={billingLoading}
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
                                title="Atualizar dados"
                            >
                                <RefreshCw size={16} className={billingLoading ? 'animate-spin' : ''} />
                            </button>
                            {billing && (
                                <div className="flex items-center gap-1.5">
                                    {billing.stripe_connected ? (
                                        <>
                                            <CheckCircle2 size={14} className="text-green-400" />
                                            <span className="text-xs text-green-400 font-medium">Stripe conectado</span>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle size={14} className="text-red-400" />
                                            <span className="text-xs text-red-400 font-medium">Stripe desconectado</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {billingLoading && !billing ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-indigo-400" size={32} />
                        </div>
                    ) : billingError ? (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <p className="text-red-400 text-sm">{billingError}</p>
                            <button
                                onClick={fetchBilling}
                                className="mt-2 text-xs text-red-300 underline hover:text-red-200"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    ) : billing ? (
                        <div className="space-y-5">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Users size={16} className="text-indigo-400" />
                                        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Assinantes ativos</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{billing.summary.active_subscribers}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        de {billing.summary.total_subscriptions} total
                                    </p>
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <DollarSign size={16} className="text-green-400" />
                                        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">MRR</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">
                                        R$ {billing.summary.mrr_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">Receita mensal recorrente</p>
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp size={16} className="text-purple-400" />
                                        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Ticket Medio</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">
                                        {billing.summary.active_subscribers > 0
                                            ? `R$ ${(billing.summary.mrr_brl / billing.summary.active_subscribers).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                            : 'R$ 0,00'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">Por assinante</p>
                                </div>
                            </div>

                            {/* Plan Breakdown */}
                            {billing.plan_breakdown.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-white mb-3">Por Plano</h3>
                                    <div className="space-y-2">
                                        {billing.plan_breakdown.map(pb => (
                                            <div key={pb.plan} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                                    <span className="text-sm text-white">{pb.label}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs text-slate-400">{pb.count} assinante{pb.count !== 1 ? 's' : ''}</span>
                                                    <span className="text-sm font-medium text-white">
                                                        R$ {(pb.revenue_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent Subscription Events */}
                            {billing.recent_events.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-white mb-3">Assinaturas Recentes</h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {billing.recent_events.slice(0, 10).map(event => {
                                            const statusInfo = STATUS_LABELS[event.status] || { label: event.status, color: 'text-slate-400 bg-slate-400/10' }
                                            return (
                                                <div key={event.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                                                            {statusInfo.label}
                                                        </span>
                                                        <div>
                                                            <span className="text-sm text-white">{event.plan_label}</span>
                                                            {event.cancel_at_period_end && (
                                                                <span className="text-xs text-yellow-400 ml-2">Cancela no fim do periodo</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm text-white">
                                                            {event.amount_cents ? `R$ ${(event.amount_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '--'}
                                                        </p>
                                                        <p className="text-xs text-slate-400">
                                                            {event.updated_at ? new Date(event.updated_at).toLocaleDateString('pt-BR') : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex flex-wrap gap-3 pt-2">
                                <a
                                    href="https://dashboard.stripe.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
                                >
                                    <ExternalLink size={14} />
                                    Abrir Stripe Dashboard
                                </a>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Danger Zone */}
                <div className="glass-panel p-6 rounded-2xl border border-red-500/20">
                    <h2 className="font-bold text-lg mb-6 flex items-center gap-2 text-red-400">
                        <Shield size={20} />
                        Zona de Perigo
                    </h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-xl border border-red-500/10">
                            <div>
                                <p className="font-medium text-red-400">Exportar Dados</p>
                                <p className="text-sm text-gray-500">Baixar todos os dados do clube</p>
                            </div>
                            <Button
                                variant="ghost"
                                className="text-red-400 hover:bg-red-500/10"
                                disabled={isExporting}
                                onClick={handleExportPatients}
                            >
                                {isExporting ? (
                                    <><Loader2 className="animate-spin mr-2" size={16} /> Exportando...</>
                                ) : (
                                    <><Download size={16} className="mr-2" /> Exportar</>
                                )}
                            </Button>
                        </div>
                        {exportToast && (
                            <div className={`p-3 rounded-xl text-sm font-medium ${
                                exportToast.type === 'success'
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                                {exportToast.type === 'success' ? <CheckCircle2 size={14} className="inline mr-2" /> : <XCircle size={14} className="inline mr-2" />}
                                {exportToast.message}
                            </div>
                        )}
                        <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-xl border border-red-500/10">
                            <div>
                                <p className="font-medium text-red-400">Resetar Ranking</p>
                                <p className="text-sm text-gray-500">Zerar pontos de todas as Rainhas</p>
                            </div>
                            <Button variant="ghost" className="text-red-400 hover:bg-red-500/10">
                                Resetar
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ToggleSetting({
    label,
    description,
    enabled,
    onToggle
}: {
    label: string,
    description: string,
    enabled: boolean,
    onToggle: () => void
}) {
    return (
        <div className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors">
            <div>
                <p className="font-medium text-white">{label}</p>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
            <button
                onClick={onToggle}
                className={`w-14 h-8 rounded-full transition-all relative
                    ${enabled ? 'bg-queen-pink' : 'bg-white/20'}`}
            >
                <div className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all
                    ${enabled ? 'left-7' : 'left-1'}`}
                />
            </button>
        </div>
    )
}
