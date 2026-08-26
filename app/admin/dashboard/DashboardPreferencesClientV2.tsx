"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, ChevronLeft, ChevronUp, GripVertical, Save, SlidersHorizontal, Zap } from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  DASHBOARD_PRESETS,
  DASHBOARD_SHORTCUTS,
  DASHBOARD_WIDGETS,
  DEFAULT_DASHBOARD_PREFERENCES,
  normalizeDashboardPreferences,
  type DashboardAttentionRules,
  type DashboardMode,
  type DashboardPreferences,
  type DashboardShortcutId,
  type DashboardWidgetId,
  type DashboardWidgetSize,
} from "@/lib/admin-dashboard"

export function DashboardPreferencesClientV2({ section = "layout" }: { section?: "layout" | "rules" }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<"" | "saved" | "error">("")
  const [message, setMessage] = useState("")
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<DashboardWidgetId | null>(null)
  const [prefs, setPrefs] = useState<DashboardPreferences>(() => normalizeDashboardPreferences(DEFAULT_DASHBOARD_PREFERENCES))

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw new Error("Sessão não encontrada.")
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("tenant_id,role")
          .eq("user_id", user.id)
          .maybeSingle()
        if (profileError || !profile?.tenant_id) throw new Error("Perfil da clínica não encontrado.")
        const role = String(profile.role || "").toLowerCase()
        if (!["admin", "nutritionist", "nutri"].includes(role)) throw new Error("Acesso restrito à equipe clínica.")
        const { data, error } = await supabase
          .from("admin_dashboard_preferences")
          .select("layout_mode,visible_widgets,favorite_shortcuts,attention_rules,display_settings")
          .eq("user_id", user.id)
          .eq("tenant_id", profile.tenant_id)
          .maybeSingle()
        if (error) throw error
        if (!mounted) return
        setUserId(user.id)
        setTenantId(profile.tenant_id)
        setPrefs(normalizeDashboardPreferences(data as Partial<DashboardPreferences> | null))
      } catch (err: any) {
        if (!mounted) return
        setStatus("error")
        setMessage(err?.message || "Não foi possível carregar as preferências.")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const widgetById = useMemo(() => new Map(DASHBOARD_WIDGETS.map((w) => [w.id, w])), [])
  const orderedWidgets = prefs.display_settings.widget_order.map((id) => widgetById.get(id)).filter(Boolean) as typeof DASHBOARD_WIDGETS

  const toggleWidget = (id: DashboardWidgetId) => setPrefs((p) => ({
    ...p,
    visible_widgets: p.visible_widgets.includes(id) ? p.visible_widgets.filter((x) => x !== id) : [...p.visible_widgets, id],
  }))

  const toggleShortcut = (id: DashboardShortcutId) => setPrefs((p) => {
    const exists = p.favorite_shortcuts.includes(id)
    if (!exists && p.favorite_shortcuts.length >= 6) return p
    return { ...p, favorite_shortcuts: exists ? p.favorite_shortcuts.filter((x) => x !== id) : [...p.favorite_shortcuts, id] }
  })

  const setRule = (key: keyof DashboardAttentionRules, value: number) => setPrefs((p) => ({
    ...p,
    attention_rules: { ...p.attention_rules, [key]: Math.max(1, Number(value || 1)) },
  }))

  const setSize = (id: DashboardWidgetId, size: DashboardWidgetSize) => setPrefs((p) => ({
    ...p,
    display_settings: { ...p.display_settings, widget_sizes: { ...p.display_settings.widget_sizes, [id]: size } },
  }))

  const setLimit = (id: DashboardWidgetId, limit: number) => setPrefs((p) => ({
    ...p,
    display_settings: { ...p.display_settings, widget_limits: { ...p.display_settings.widget_limits, [id]: Math.max(1, Math.min(8, limit)) } },
  }))

  const moveWidget = (from: DashboardWidgetId, to: DashboardWidgetId) => setPrefs((p) => {
    const order = [...p.display_settings.widget_order]
    const a = order.indexOf(from)
    const b = order.indexOf(to)
    if (a < 0 || b < 0 || a === b) return p
    order.splice(a, 1)
    order.splice(b, 0, from)
    return { ...p, display_settings: { ...p.display_settings, widget_order: order } }
  })

  const nudgeWidget = (id: DashboardWidgetId, delta: -1 | 1) => setPrefs((p) => {
    const order = [...p.display_settings.widget_order]
    const index = order.indexOf(id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= order.length) return p
    ;[order[index], order[target]] = [order[target], order[index]]
    return { ...p, display_settings: { ...p.display_settings, widget_order: order } }
  })

  const applyPreset = (mode: DashboardMode) => {
    const preset = DASHBOARD_PRESETS[mode]
    setPrefs((p) => normalizeDashboardPreferences({
      ...p,
      layout_mode: mode,
      visible_widgets: [...preset.visible_widgets],
      favorite_shortcuts: [...preset.favorite_shortcuts],
      display_settings: {
        ...preset.display_settings,
        widget_sizes: { ...preset.display_settings.widget_sizes },
        widget_limits: { ...preset.display_settings.widget_limits },
        widget_order: [...preset.display_settings.widget_order],
      },
    }))
  }

  const save = async () => {
    if (!userId || !tenantId || saving) return
    setSaving(true)
    setStatus("")
    setMessage("")
    const clean = normalizeDashboardPreferences(prefs)
    const { error } = await supabase.from("admin_dashboard_preferences").upsert({
      user_id: userId,
      tenant_id: tenantId,
      layout_mode: clean.layout_mode,
      visible_widgets: clean.visible_widgets,
      favorite_shortcuts: clean.favorite_shortcuts,
      attention_rules: clean.attention_rules,
      display_settings: clean.display_settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,tenant_id" })
    setSaving(false)
    if (error) {
      setStatus("error")
      setMessage(error.message || "Não foi possível salvar.")
      return
    }
    setPrefs(clean)
    setStatus("saved")
    setMessage("Alterações salvas.")
    setTimeout(() => { setStatus(""); setMessage("") }, 2200)
  }

  const modes = [
    { id: "today" as DashboardMode, label: "Hoje", desc: "Agenda, atenção e pendências primeiro." },
    { id: "clinical" as DashboardMode, label: "Clínica", desc: "Pacientes, adesão e planejamento clínico." },
    { id: "management" as DashboardMode, label: "Gestão", desc: "CRM, operação e indicadores." },
  ]

  if (loading) return <main className="min-h-[70vh] p-6 lg:p-10"><div className="h-32 animate-pulse rounded-3xl border border-[#DCE6E3] bg-white" /></main>

  return <main className="min-h-screen bg-[#F4F7F6] p-4 pb-28 text-[#1C2B27] sm:p-6 lg:p-10"><div className="mx-auto max-w-6xl">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <Link href="/admin/dashboard" className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#5D6C68] hover:text-[#0D7166]"><ChevronLeft size={16} />Voltar ao painel</Link>
        <div className="flex items-center gap-3"><div className="rounded-2xl border border-[#B8DED5] bg-[#E2F3EF] p-3 text-[#0D7166]"><SlidersHorizontal size={22} /></div><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#0D7166]">Painel 2.3</p><h1 className="text-2xl font-black sm:text-3xl">{section === "rules" ? "Regras de atenção" : "Personalizar painel"}</h1></div></div>
      </div>
      <div className="flex gap-2"><Link href="/admin/dashboard/settings" className={`rounded-xl px-4 py-2 text-sm font-black ${section === "layout" ? "bg-[#E2F3EF] text-[#0D7166]" : "border border-[#DCE6E3] bg-white text-[#52615D]"}`}>Painel</Link><Link href="/admin/dashboard/rules" className={`rounded-xl px-4 py-2 text-sm font-black ${section === "rules" ? "bg-[#E2F3EF] text-[#0D7166]" : "border border-[#DCE6E3] bg-white text-[#52615D]"}`}>Regras</Link></div>
    </div>

    {status === "error" && <div role="alert" className="mb-5 rounded-2xl border border-[#F0C9C9] bg-[#FFF5F5] p-4 text-sm font-bold text-[#8E3434]">{message}</div>}

    {section === "layout" ? <div className="space-y-6">
      <section className="rounded-3xl border border-[#DCE6E3] bg-white p-5 shadow-sm sm:p-6"><h2 className="font-black">Presets de trabalho</h2><p className="mt-1 text-sm text-[#687772]">Um clique reorganiza o painel; depois você pode ajustar manualmente.</p><div className="mt-4 grid gap-3 md:grid-cols-3">{modes.map((m) => <button key={m.id} onClick={() => applyPreset(m.id)} className={`rounded-2xl border p-4 text-left ${prefs.layout_mode === m.id ? "border-[#0D7166] bg-[#EAF5F2]" : "border-[#DCE6E3] hover:bg-[#F7FAF9]"}`}><div className="flex items-center justify-between"><span className="font-black">{m.label}</span>{prefs.layout_mode === m.id && <Check size={17} className="text-[#0D7166]" />}</div><p className="mt-1 text-sm text-[#687772]">{m.desc}</p></button>)}</div></section>

      <section className="rounded-3xl border border-[#DCE6E3] bg-white p-5 shadow-sm sm:p-6"><h2 className="font-black">Ordem e densidade dos blocos</h2><p className="mt-1 text-sm text-[#687772]">Arraste no desktop ou use as setas no celular para ordenar.</p><div className="mt-4 space-y-2">{orderedWidgets.map((w, index) => { const visible = prefs.visible_widgets.includes(w.id); return <div key={w.id} draggable onDragStart={() => setDragging(w.id)} onDragEnd={() => setDragging(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragging) moveWidget(dragging, w.id); setDragging(null) }} className={`rounded-2xl border p-3 sm:p-4 ${visible ? "border-[#CFE1DD] bg-[#F9FBFA]" : "border-[#E1E7E5] bg-[#F5F7F6] opacity-70"}`}><div className="flex flex-wrap items-center gap-3"><GripVertical size={18} className="hidden cursor-grab text-[#899590] sm:block" /><div className="flex gap-1 sm:hidden"><button type="button" disabled={index === 0} onClick={() => nudgeWidget(w.id, -1)} aria-label={`Mover ${w.label} para cima`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D3DEDB] bg-white disabled:opacity-30"><ChevronUp size={15} /></button><button type="button" disabled={index === orderedWidgets.length - 1} onClick={() => nudgeWidget(w.id, 1)} aria-label={`Mover ${w.label} para baixo`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D3DEDB] bg-white disabled:opacity-30"><ChevronDown size={15} /></button></div><button type="button" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${w.label}`} onClick={() => toggleWidget(w.id)} className={`flex h-8 w-8 items-center justify-center rounded-lg border ${visible ? "border-[#0D7166] bg-[#0D7166] text-white" : "border-[#B7C4C0] bg-white"}`}>{visible && <Check size={14} />}</button><div className="min-w-[170px] flex-1"><p className="text-sm font-black">{w.label}</p><p className="text-xs text-[#71807B]">{w.description}</p></div><div className="flex flex-wrap items-center gap-2"><label className="text-[11px] font-black text-[#687772]">Tamanho</label><select value={prefs.display_settings.widget_sizes[w.id]} onChange={(e) => setSize(w.id, e.target.value as DashboardWidgetSize)} className="min-h-10 rounded-lg border border-[#CEDAD7] bg-white px-2 text-xs font-bold"><option value="normal">Normal</option><option value="compact">Compacto</option></select><label className="ml-1 text-[11px] font-black text-[#687772]">Itens</label><select value={prefs.display_settings.widget_limits[w.id]} onChange={(e) => setLimit(w.id, Number(e.target.value))} className="min-h-10 rounded-lg border border-[#CEDAD7] bg-white px-2 text-xs font-bold">{[2,3,4,5,6,8].map((n) => <option key={n} value={n}>{n}</option>)}</select></div></div></div> })}</div>
        <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-[#DCE6E3] p-4"><div><p className="text-sm font-black">Ocultar valores financeiros</p><p className="text-xs text-[#687772]">Preparado para widgets financeiros futuros.</p></div><input type="checkbox" checked={prefs.display_settings.hide_financial_values} onChange={(e) => setPrefs((p) => ({ ...p, display_settings: { ...p.display_settings, hide_financial_values: e.target.checked } }))} className="h-5 w-5 accent-[#0D7166]" /></label>
      </section>

      <section className="rounded-3xl border border-[#DCE6E3] bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center gap-2"><Zap size={19} className="text-[#0D7166]" /><div><h2 className="font-black">Atalhos favoritos</h2><p className="text-sm text-[#687772]">Escolha até 6 ações para o topo.</p></div></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{DASHBOARD_SHORTCUTS.map((s) => <button key={s.id} onClick={() => toggleShortcut(s.id)} className={`rounded-2xl border p-4 text-left ${prefs.favorite_shortcuts.includes(s.id) ? "border-[#0D7166] bg-[#EAF5F2]" : "border-[#DCE6E3]"}`}><div className="flex items-center justify-between"><span className="text-sm font-black">{s.label}</span>{prefs.favorite_shortcuts.includes(s.id) && <Check size={15} className="text-[#0D7166]" />}</div><p className="mt-1 text-xs text-[#687772]">{s.description}</p></button>)}</div></section>
    </div> : <section className="rounded-3xl border border-[#DCE6E3] bg-white p-5 shadow-sm sm:p-6"><h2 className="font-black">Limites de leitura da Home</h2><p className="mt-1 text-sm text-[#687772]">O limite de inatividade afeta o resumo da Home. Os demais limites ficam salvos para o motor configurável de acompanhamento; o escore clínico oficial não é alterado nesta tela.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{[["no_checkin_days","Sem check-in por","dias"],["no_next_appointment_days","Sem próximo retorno após","dias"],["inactive_days","Considerar atividade recente por","dias"],["protocol_ending_days","Avisar protocolo terminando em","dias"],["unanswered_message_hours","Mensagem sem resposta por","horas"]].map(([key,label,suffix]) => <label key={key} className="rounded-2xl border border-[#DCE6E3] p-4"><span className="mb-2 block text-sm font-black">{label}</span><div className="flex items-center gap-2"><input type="number" min={1} value={prefs.attention_rules[key as keyof DashboardAttentionRules]} onChange={(e) => setRule(key as keyof DashboardAttentionRules, Number(e.target.value))} className="w-24 rounded-xl border border-[#C9D6D2] bg-white px-3 py-2 font-black outline-none focus:border-[#0D7166]" /><span className="text-sm text-[#687772]">{suffix}</span></div></label>)}</div></section>}

    <div className="sticky bottom-4 mt-6 flex items-center justify-end gap-3"><span aria-live="polite" className={`text-sm font-bold ${status === "error" ? "text-[#A03C3C]" : "text-[#2C7A61]"}`}>{status === "saved" ? message : ""}</span><button onClick={save} disabled={saving || !userId || !tenantId} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#0D7166] px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-[#095E55] disabled:opacity-60"><Save size={17} />{saving ? "Salvando..." : "Salvar alterações"}</button></div>
  </div></main>
}
