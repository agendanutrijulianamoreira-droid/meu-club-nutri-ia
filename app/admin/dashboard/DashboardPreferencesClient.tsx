"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Check, ChevronLeft, Eye, Gauge, LayoutDashboard, Save, SlidersHorizontal, Zap } from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  DASHBOARD_SHORTCUTS,
  DASHBOARD_WIDGETS,
  DEFAULT_DASHBOARD_PREFERENCES,
  normalizeDashboardPreferences,
  type DashboardAttentionRules,
  type DashboardMode,
  type DashboardPreferences,
  type DashboardShortcutId,
  type DashboardWidgetId,
} from "@/lib/admin-dashboard"

export function DashboardPreferencesClient({ section = "layout" }: { section?: "layout" | "rules" }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFERENCES)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data: profile } = await supabase.from('profiles').select('tenant_id,role').eq('user_id', user.id).maybeSingle()
      if (!mounted || !profile?.tenant_id) return
      const { data } = await supabase.from('admin_dashboard_preferences').select('layout_mode,visible_widgets,favorite_shortcuts,attention_rules').eq('user_id', user.id).eq('tenant_id', profile.tenant_id).maybeSingle()
      if (!mounted) return
      setUserId(user.id)
      setTenantId(profile.tenant_id)
      setPrefs(normalizeDashboardPreferences(data as Partial<DashboardPreferences> | null))
      setLoading(false)
    })().catch(() => setLoading(false))
    return () => { mounted = false }
  }, [])

  const toggleWidget = (id: DashboardWidgetId) => {
    setPrefs(p => ({ ...p, visible_widgets: p.visible_widgets.includes(id) ? p.visible_widgets.filter(x => x !== id) : [...p.visible_widgets, id] }))
  }
  const toggleShortcut = (id: DashboardShortcutId) => {
    setPrefs(p => {
      const exists = p.favorite_shortcuts.includes(id)
      if (!exists && p.favorite_shortcuts.length >= 6) return p
      return { ...p, favorite_shortcuts: exists ? p.favorite_shortcuts.filter(x => x !== id) : [...p.favorite_shortcuts, id] }
    })
  }
  const setRule = (key: keyof DashboardAttentionRules, value: number) => setPrefs(p => ({ ...p, attention_rules: { ...p.attention_rules, [key]: Math.max(1, Number(value || 1)) } }))

  const save = async () => {
    if (!userId || !tenantId) return
    setSaving(true); setSaved(false)
    const { error } = await supabase.from('admin_dashboard_preferences').upsert({
      user_id: userId,
      tenant_id: tenantId,
      layout_mode: prefs.layout_mode,
      visible_widgets: prefs.visible_widgets,
      favorite_shortcuts: prefs.favorite_shortcuts,
      attention_rules: prefs.attention_rules,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,tenant_id' })
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2200) }
  }

  const modeCards = useMemo(() => [
    { id: 'today' as DashboardMode, label: 'Hoje', desc: 'Foco no que precisa ser resolvido agora.' },
    { id: 'clinical' as DashboardMode, label: 'Clínica', desc: 'Prioriza pacientes, adesão e pendências clínicas.' },
    { id: 'management' as DashboardMode, label: 'Gestão', desc: 'Prioriza CRM, operação e indicadores.' },
  ], [])

  if (loading) return <main className="min-h-[70vh] p-6 lg:p-10"><div className="animate-pulse h-32 rounded-3xl bg-white border border-[#DCE6E3]" /></main>

  return <main className="min-h-screen bg-[#F4F7F6] text-[#1C2B27] p-4 sm:p-6 lg:p-10">
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-[#5D6C68] hover:text-[#0D7166]"><ChevronLeft size={16}/> Voltar ao painel</Link>
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-[#E2F3EF] border border-[#B8DED5] p-3 text-[#0D7166]"><SlidersHorizontal size={22}/></div><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#0D7166]">Painel 2.0</p><h1 className="text-2xl sm:text-3xl font-black">{section === 'rules' ? 'Regras de atenção' : 'Configurar meu painel'}</h1></div></div>
        </div>
        <div className="flex gap-2"><Link href="/admin/dashboard/settings" className={`rounded-xl px-4 py-2 text-sm font-black ${section==='layout'?'bg-[#E2F3EF] text-[#0D7166]':'bg-white border border-[#DCE6E3] text-[#52615D]'}`}>Painel</Link><Link href="/admin/dashboard/rules" className={`rounded-xl px-4 py-2 text-sm font-black ${section==='rules'?'bg-[#E2F3EF] text-[#0D7166]':'bg-white border border-[#DCE6E3] text-[#52615D]'}`}>Regras</Link></div>
      </div>

      {section === 'layout' ? <div className="space-y-6">
        <section className="rounded-3xl bg-white border border-[#DCE6E3] p-5 sm:p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><Gauge className="text-[#0D7166]" size={20}/><div><h2 className="font-black">Modo de trabalho</h2><p className="text-sm text-[#687772]">Escolha a ênfase padrão da página inicial.</p></div></div><div className="grid gap-3 md:grid-cols-3">{modeCards.map(m => <button key={m.id} onClick={() => setPrefs(p => ({...p, layout_mode:m.id}))} className={`text-left rounded-2xl border p-4 transition ${prefs.layout_mode===m.id?'border-[#0D7166] bg-[#EAF5F2]':'border-[#DCE6E3] hover:bg-[#F7FAF9]'}`}><div className="flex items-center justify-between"><span className="font-black">{m.label}</span>{prefs.layout_mode===m.id&&<Check size={17} className="text-[#0D7166]"/>}</div><p className="mt-1 text-sm text-[#687772]">{m.desc}</p></button>)}</div></section>
        <section className="rounded-3xl bg-white border border-[#DCE6E3] p-5 sm:p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><Eye className="text-[#0D7166]" size={20}/><div><h2 className="font-black">Blocos visíveis</h2><p className="text-sm text-[#687772]">Mostre apenas o que ajuda você a decidir e agir.</p></div></div><div className="grid gap-3 md:grid-cols-2">{DASHBOARD_WIDGETS.map(w => <button key={w.id} onClick={()=>toggleWidget(w.id)} className={`text-left rounded-2xl border p-4 ${prefs.visible_widgets.includes(w.id)?'border-[#B8DED5] bg-[#F0F8F6]':'border-[#DCE6E3]'}`}><div className="flex items-start justify-between gap-4"><div><p className="font-black">{w.label}</p><p className="mt-1 text-sm text-[#687772]">{w.description}</p></div><div className={`h-6 w-6 rounded-lg border flex items-center justify-center ${prefs.visible_widgets.includes(w.id)?'bg-[#0D7166] border-[#0D7166] text-white':'border-[#B7C4C0]'}`}>{prefs.visible_widgets.includes(w.id)&&<Check size={14}/>}</div></div></button>)}</div></section>
        <section className="rounded-3xl bg-white border border-[#DCE6E3] p-5 sm:p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><Zap className="text-[#0D7166]" size={20}/><div><h2 className="font-black">Atalhos favoritos</h2><p className="text-sm text-[#687772]">Escolha até 6 ações para o topo do painel.</p></div></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{DASHBOARD_SHORTCUTS.map(s => <button key={s.id} onClick={()=>toggleShortcut(s.id)} className={`text-left rounded-2xl border p-4 ${prefs.favorite_shortcuts.includes(s.id)?'border-[#0D7166] bg-[#EAF5F2]':'border-[#DCE6E3]'}`}><div className="flex items-center justify-between"><span className="font-black text-sm">{s.label}</span>{prefs.favorite_shortcuts.includes(s.id)&&<Check size={15} className="text-[#0D7166]"/>}</div><p className="mt-1 text-xs text-[#687772]">{s.description}</p></button>)}</div></section>
      </div> : <section className="rounded-3xl bg-white border border-[#DCE6E3] p-5 sm:p-6 shadow-sm"><div className="mb-5"><h2 className="font-black">Quando o sistema deve chamar sua atenção?</h2><p className="text-sm text-[#687772] mt-1">Esses limites personalizam a leitura do Painel 2.0. O motor clínico oficial continua preservado.</p></div><div className="grid gap-4 md:grid-cols-2">{[
        ['no_checkin_days','Sem check-in por', 'dias'],['no_next_appointment_days','Sem próximo retorno após', 'dias'],['inactive_days','Considerar inativa após', 'dias'],['protocol_ending_days','Avisar protocolo terminando em', 'dias'],['unanswered_message_hours','Mensagem sem resposta por', 'horas']
      ].map(([key,label,suffix]) => <label key={key} className="rounded-2xl border border-[#DCE6E3] p-4"><span className="block text-sm font-black mb-2">{label}</span><div className="flex items-center gap-2"><input type="number" min={1} value={prefs.attention_rules[key as keyof DashboardAttentionRules]} onChange={e=>setRule(key as keyof DashboardAttentionRules, Number(e.target.value))} className="w-24 rounded-xl border border-[#C9D6D2] bg-white px-3 py-2 font-black outline-none focus:border-[#0D7166]"/><span className="text-sm text-[#687772]">{suffix}</span></div></label>)}</div></section>}

      <div className="sticky bottom-4 mt-6 flex justify-end"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-[#0D7166] px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-[#095E55] disabled:opacity-60"><Save size={17}/>{saving?'Salvando...':saved?'Salvo':'Salvar alterações'}</button></div>
    </div>
  </main>
}
