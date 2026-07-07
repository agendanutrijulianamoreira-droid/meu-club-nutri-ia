"use client"

import React, { useState, useEffect } from "react"
import { User, CreditCard, Save, Loader2, ExternalLink, BadgeCheck, Phone, Mail, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import SlideOver from "@/components/ui/SlideOver"
import { useOverlays } from "@/components/ui/OverlayStack"
import { supabase } from "@/lib/supabase-browser"
import { updateProfileAction } from "../actions/profileActions"

export default function AccountOverlay({ index }: { index: number }) {
    const { closeOverlay } = useOverlays()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [formData, setFormData] = useState({
        honorific: "",
        display_name: "",
        phone: "",
        license_type: "CRN",
        license_number: "",
        license_state: "",
        specialty: "",
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
                    honorific: data.honorific || "",
                    display_name: data.display_name || data.name || "",
                    phone: data.phone || "",
                    license_type: data.license_type || "CRN",
                    license_number: data.license_number || "",
                    license_state: data.license_state || "",
                    specialty: data.specialty || "",
                    avatar_url: data.avatar_url || ""
                })
            }
            setLoading(false)
        }
        loadProfile()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        const result = await updateProfileAction(formData)
        const msg = result.success
            ? { type: 'success' as const, text: "Perfil atualizado com sucesso!" }
            : { type: 'error' as const, text: "Erro ao salvar: " + result.error }
        setSaveMsg(msg)
        setTimeout(() => setSaveMsg(null), 3500)
        setSaving(false)
    }

    if (loading) return (
        <SlideOver id="account" title="Carregando..." index={index}>
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
        </SlideOver>
    )

    return (
        <SlideOver id="account" title="Meu Perfil Profissional" index={index}>
            <div className="space-y-10 pb-20">
                {saveMsg && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold border ${saveMsg.type === 'error' ? 'bg-rose-500/10 border-rose-500/25 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'}`}>
                        {saveMsg.text}
                    </div>
                )}
                {/* Header Profile Photo */}
                <div className="flex flex-col items-center gap-4 py-6 bg-indigo-600/5 rounded-[2.5rem] border border-indigo-500/10">
                    <div className="h-28 w-28 rounded-3xl border-2 border-indigo-500/30 p-1 relative group cursor-pointer">
                        <img
                            src={formData.avatar_url || `https://api.dicebear.com/9.x/micah/svg?seed=${profile?.user_id}`}
                            className="w-full h-full rounded-2xl bg-slate-900 object-cover"
                            alt="avatar"
                        />
                        <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="text-[10px] font-black uppercase text-white">Alterar</span>
                        </div>
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-black text-white italic">{formData.display_name || 'Profissional'}</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{formData.specialty || 'Especialidade não definida'}</p>
                    </div>
                </div>

                {/* Identity Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-indigo-400 ml-1">
                        <BadgeCheck size={18} />
                        <h4 className="font-black uppercase tracking-widest text-xs">Identidade Profissional</h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Tratamento</label>
                                <input
                                    value={formData.honorific}
                                    onChange={e => setFormData({ ...formData, honorific: e.target.value })}
                                    placeholder="Ex: Dra."
                                    className="w-full bg-slate-900/50 border border-white/5 rounded-xl p-4 text-white focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div className="col-span-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Nome de Exibição</label>
                                <input
                                    value={formData.display_name}
                                    onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-white/5 rounded-xl p-4 text-white focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Especialidade Principal</label>
                            <input
                                value={formData.specialty}
                                onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                                placeholder="Ex: Nutrição Esportiva e Funcional"
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl p-4 text-white focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </section>

                {/* License Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-purple-400 ml-1">
                        <Award size={18} />
                        <h4 className="font-black uppercase tracking-widest text-xs">Registro Profissional</h4>
                    </div>

                    <div className="grid grid-cols-3 gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Tipo</label>
                            <select
                                value={formData.license_type}
                                onChange={e => setFormData({ ...formData, license_type: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-white outline-none"
                            >
                                <option value="CRN">CRN</option>
                                <option value="CRM">CRM</option>
                                <option value="CREF">CREF</option>
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Número</label>
                            <input
                                value={formData.license_number}
                                onChange={e => setFormData({ ...formData, license_number: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-white outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">UF</label>
                            <input
                                value={formData.license_state}
                                onChange={e => setFormData({ ...formData, license_state: e.target.value })}
                                placeholder="SP"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-white outline-none"
                            />
                        </div>
                    </div>
                </section>

                {/* Contact Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-emerald-400 ml-1">
                        <Phone size={18} />
                        <h4 className="font-black uppercase tracking-widest text-xs">Contato Direto</h4>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4 bg-slate-900/50 border border-white/5 p-4 rounded-xl">
                            <Mail size={20} className="text-slate-600" />
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">E-mail (Login)</p>
                                <p className="text-sm font-bold text-white/50">{profile?.email}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">WhatsApp Pessoal</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                                <input
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-white/5 rounded-xl p-4 pl-12 text-white focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-white text-slate-950 hover:bg-slate-200 h-16 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-white/5 gap-3"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Atualizar Meu Perfil
                </Button>

                <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] pt-4">
                    Suas alterações refletem em toda a plataforma.
                </p>
            </div>
        </SlideOver>
    )
}
