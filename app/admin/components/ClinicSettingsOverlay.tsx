"use client"

import React, { useState, useEffect } from "react"
import { Building2, Save, Loader2, Globe, Instagram, MapPin, Palette, Hash, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import SlideOver from "@/components/ui/SlideOver"
import { useOverlays } from "@/components/ui/OverlayStack"
import { supabase } from "@/lib/supabase-browser"
import { updateClinicAction } from "../actions/profileActions"

export default function ClinicSettingsOverlay({ index }: { index: number }) {
    const { closeOverlay } = useOverlays()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [tenant, setTenant] = useState<any>(null)
    const [formData, setFormData] = useState({
        brand_name: "",
        clinic_phone: "",
        clinic_whatsapp: "",
        clinic_address: "",
        clinic_instagram: "",
        brand_color: "#6366f1",
        logo_url: ""
    })

    useEffect(() => {
        const loadClinic = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from("profiles")
                .select("tenant_id")
                .eq("user_id", user.id)
                .single()

            if (profile?.tenant_id) {
                const { data } = await supabase
                    .from("tenants")
                    .select("*")
                    .eq("id", profile.tenant_id)
                    .single()

                if (data) {
                    setTenant(data)
                    setFormData({
                        brand_name: data.brand_name || "",
                        clinic_phone: data.clinic_phone || "",
                        clinic_whatsapp: data.clinic_whatsapp || "",
                        clinic_address: data.clinic_address || "",
                        clinic_instagram: data.clinic_instagram || "",
                        brand_color: data.brand_color || "#6366f1",
                        logo_url: data.logo_url || ""
                    })
                }
            }
            setLoading(false)
        }
        loadClinic()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        const result = await updateClinicAction(formData)
        if (result.success) {
            alert("Informações da clínica atualizadas! 🏥")
        } else {
            alert("Erro ao salvar: " + result.error)
        }
        setSaving(false)
    }

    if (loading) return (
        <SlideOver id="clinic" title="Carregando..." index={index}>
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
        </SlideOver>
    )

    return (
        <SlideOver id="clinic" title="Minha Clínica / Consultório" index={index}>
            <div className="space-y-10 pb-20">
                {/* Branding Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-indigo-400 ml-1">
                        <Building2 size={18} />
                        <h4 className="font-black uppercase tracking-widest text-xs">Identidade Visual</h4>
                    </div>

                    <div className="space-y-6 bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem]">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Nome da Empresa / Clínica</label>
                            <input
                                value={formData.brand_name}
                                onChange={e => setFormData({ ...formData, brand_name: e.target.value })}
                                className="w-full bg-slate-900 border border-white/10 rounded-2xl p-5 text-white focus:border-indigo-500 transition-all outline-none font-bold"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Cor da Marca</label>
                                <div className="flex bg-slate-900 border border-white/10 rounded-2xl p-3 items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.brand_color}
                                        onChange={e => setFormData({ ...formData, brand_color: e.target.value })}
                                        className="w-10 h-10 rounded-xl bg-transparent border-none cursor-pointer overflow-hidden"
                                    />
                                    <input
                                        type="text"
                                        value={formData.brand_color}
                                        onChange={e => setFormData({ ...formData, brand_color: e.target.value })}
                                        className="flex-1 bg-transparent text-white font-mono text-sm uppercase outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Sigla / Slug (URL)</label>
                                <div className="bg-slate-950 border border-white/5 rounded-2xl p-5 text-slate-600 text-xs font-mono">
                                    /{tenant?.slug || '...'}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Contact Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-emerald-400 ml-1">
                        <Phone size={18} />
                        <h4 className="font-black uppercase tracking-widest text-xs">Informações de Contato</h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Telefone Fixo</label>
                                <input
                                    value={formData.clinic_phone}
                                    onChange={e => setFormData({ ...formData, clinic_phone: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-white focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">WhatsApp Clínica</label>
                                <input
                                    value={formData.clinic_whatsapp}
                                    onChange={e => setFormData({ ...formData, clinic_whatsapp: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-white focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Endereço Completo</label>
                            <div className="relative">
                                <MapPin size={16} className="absolute left-4 top-4 text-slate-600" />
                                <textarea
                                    value={formData.clinic_address}
                                    onChange={e => setFormData({ ...formData, clinic_address: e.target.value })}
                                    className="w-full h-24 bg-slate-900 border border-white/5 rounded-xl p-4 pl-12 text-white focus:border-indigo-500 outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Instagram (@)</label>
                            <div className="relative">
                                <Instagram size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                                <input
                                    value={formData.clinic_instagram}
                                    onChange={e => setFormData({ ...formData, clinic_instagram: e.target.value })}
                                    placeholder="nutri.clinica"
                                    className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 pl-12 text-white focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-16 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-900/20 gap-3"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar Dados da Clínica
                </Button>

                <div className="pt-6 text-center">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] max-w-[200px] mx-auto leading-relaxed">
                        Essas informações aparecem no rodapé do aplicativo do paciente.
                    </p>
                </div>
            </div>
        </SlideOver>
    )
}
