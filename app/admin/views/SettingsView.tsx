"use client"

import { useState, useEffect } from "react"
import { Save, Palette, Image, Type, CreditCard, Bell, Shield, Globe, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTenant } from "@/lib/hooks/useDatabase"
import { useStorage } from "@/lib/hooks/useStorage"

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

                {/* Payments */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                    <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
                        <CreditCard size={20} className="text-green-500" />
                        Pagamentos
                    </h2>

                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <p className="text-yellow-400 text-sm">
                            💡 Integração com Stripe/Pagar.me será ativada na Fase 4 do desenvolvimento.
                        </p>
                    </div>
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
                            <Button variant="ghost" className="text-red-400 hover:bg-red-500/10">
                                Exportar
                            </Button>
                        </div>
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
