"use client"

import React from "react"
import { User, CreditCard, Save, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import SlideOver from "@/components/ui/SlideOver"
import { useOverlays } from "@/components/ui/OverlayStack"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase-browser"

export default function AccountOverlay({ index }: { index: number }) {
    const { closeOverlay } = useOverlays()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        avatar_url: ""
    })

    useEffect(() => {
        const loadProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await supabase
                .from("profiles")
                .select("*")
                .eq("user_id", user.id)
                .single()

            if (data) {
                setProfile(data)
                setFormData({
                    name: data.name || "",
                    phone: data.phone || "",
                    avatar_url: data.avatar_url || ""
                })
            }
            setLoading(false)
        }
        loadProfile()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Não autenticado")

            const { error } = await supabase
                .from("profiles")
                .update({
                    name: formData.name,
                    phone: formData.phone,
                    avatar_url: formData.avatar_url
                })
                .eq("user_id", user.id)

            if (error) throw error
            alert("Perfil atualizado com sucesso!")
        } catch (err) {
            console.error(err)
            alert("Erro ao salvar perfil.")
        } finally {
            setSaving(false)
        }
    }

    const openBillingPortal = async () => {
        try {
            const res = await fetch("/api/billing-portal", { method: "POST" })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            } else {
                alert("Erro ao abrir portal de faturamento. Verifique se o Stripe está configurado.")
            }
        } catch (err) {
            console.error(err)
            alert("Erro de conexão.")
        }
    }

    if (loading) return (
        <SlideOver id="account" title="Carregando..." index={index}>
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
        </SlideOver>
    )

    return (
        <SlideOver id="account" title="Minha Conta" index={index}>
            <div className="space-y-10">
                {/* Profile Section */}
                <section>
                    <div className="flex items-center gap-2 mb-6 text-indigo-400">
                        <User size={20} />
                        <h3 className="font-black uppercase tracking-widest text-sm">Dados Pessoais</h3>
                    </div>

                    <div className="space-y-6 bg-white/[0.02] border border-white/5 p-6 rounded-3xl">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1">Nome</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-white focus:border-indigo-500 transition-all outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1">Telefone / WhatsApp</label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-white focus:border-indigo-500 transition-all outline-none"
                            />
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 h-14 rounded-xl font-bold uppercase tracking-widest text-xs gap-2"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Salvar Alterações
                        </Button>
                    </div>
                </section>

                {/* Subscription Section */}
                <section>
                    <div className="flex items-center gap-2 mb-6 text-purple-400">
                        <CreditCard size={20} />
                        <h3 className="font-black uppercase tracking-widest text-sm">Plano & Assinatura</h3>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 p-8 rounded-[2rem] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6">
                            <div className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-3 py-1 rounded-full border border-indigo-500/30 uppercase tracking-widest">
                                {profile?.current_plan || 'Nenhum'}
                            </div>
                        </div>

                        <div className="relative z-10">
                            <h4 className="text-2xl font-black text-white italic mb-2">Seu Plano Atual</h4>
                            <p className="text-slate-400 text-sm mb-6">
                                {profile?.plan_expires_at
                                    ? `Ativo até ${new Date(profile.plan_expires_at).toLocaleDateString()}`
                                    : 'Aproveite o acesso completo à plataforma.'}
                            </p>

                            <Button
                                onClick={openBillingPortal}
                                variant="outline"
                                className="w-full h-14 border-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2 hover:bg-white/5"
                            >
                                <ExternalLink size={14} /> Gerenciar no Stripe
                            </Button>
                        </div>

                        {/* Decor */}
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-600/10 blur-3xl rounded-full" />
                    </div>
                </section>

                <div className="pt-10 border-t border-white/5">
                    <button
                        onClick={() => closeOverlay("account")}
                        className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-white transition-all underline underline-offset-4"
                    >
                        Voltar para o sistema
                    </button>
                </div>
            </div>
        </SlideOver>
    )
}
