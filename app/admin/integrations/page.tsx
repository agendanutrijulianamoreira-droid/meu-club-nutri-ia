import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { IntegrationTestButton } from './IntegrationTestButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const STAFF = ['admin', 'nutritionist', 'nutri']

const PROVIDERS = [
  { id:'meta_whatsapp', title:'WhatsApp', subtitle:'Confirmações, lembretes e reagendamento', icon:'WA', essential:true, keys:['PHONE_NUMBER_ID','WABA_ID','ACCESS_TOKEN','WEBHOOK_VERIFY_TOKEN','APP_SECRET'], action:'/admin/appointments/communications/whatsapp/go-live', actionLabel:'Abrir go-live' },
  { id:'google_workspace', title:'Google Workspace', subtitle:'Agenda, Meet e Drive', icon:'G', essential:true, keys:['CLIENT_ID','CLIENT_SECRET'], oauth:true },
  { id:'gemini', title:'Google Gemini', subtitle:'IA do sistema e agentes clínicos', icon:'AI', essential:true, keys:['API_KEY'] },
  { id:'resend', title:'Resend', subtitle:'E-mail transacional', icon:'@', keys:['API_KEY','FROM_EMAIL'] },
  { id:'asaas', title:'Asaas', subtitle:'Pix, boleto, cartão e recorrência', icon:'A$', keys:['API_KEY'] },
  { id:'zoom', title:'Zoom', subtitle:'Videoconsulta alternativa ao Meet', icon:'VC', keys:['ACCOUNT_ID','CLIENT_ID','CLIENT_SECRET'] },
  { id:'automation', title:'n8n', subtitle:'Automações e integrações de cauda longa', icon:'<>', keys:['N8N_BASE_URL'] },
  { id:'mercadopago', title:'Mercado Pago', subtitle:'Alternativa de pagamentos', icon:'MP', keys:['ACCESS_TOKEN'] },
  { id:'stripe', title:'Stripe', subtitle:'Checkout e assinaturas globais', icon:'S$', keys:['SECRET_KEY'] },
] as const

export default async function IntegrationsPage({ searchParams }: { searchParams?: { google?: string; error?: string } }) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('tenant_id,role').eq('user_id', user.id).maybeSingle()
  if (!profile?.tenant_id || !STAFF.includes(String(profile.role || '').toLowerCase())) redirect('/patient/home')

  const tenantId = profile.tenant_id
  const [{ data: settings }, { data: channel }, { data: syncRows }] = await Promise.all([
    supabase.from('tenant_vital_settings').select('provider,setting_key,validation_status,enabled').eq('tenant_id', tenantId).eq('enabled', true),
    supabase.from('appointment_communication_channel_settings').select('whatsapp_activation_state,whatsapp_pilot_mode').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('appointment_calendar_sync').select('status').eq('tenant_id', tenantId),
  ])

  const byProvider = new Map<string, Map<string,string>>()
  for (const row of settings || []) {
    if (!byProvider.has(row.provider)) byProvider.set(row.provider, new Map())
    byProvider.get(row.provider)!.set(row.setting_key, row.validation_status)
  }
  const googleConnected = byProvider.get('google_workspace')?.has('REFRESH_TOKEN') || false
  const synced = (syncRows || []).filter((x:any) => x.status === 'synced').length
  const pending = (syncRows || []).filter((x:any) => ['pending','syncing','error','delete_pending'].includes(x.status)).length

  return (
    <main className="min-h-screen bg-[#F4F7F6] px-4 py-7 text-[#1C2B27] md:px-7">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#0D7166]">Configurações</p>
            <h1 className="mt-1 text-3xl font-black">Integrações da clínica</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#5C6B67]">Conexões que reduzem trabalho operacional. Salvar uma chave não ativa disparos ou cobranças automaticamente.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin" className="rounded-xl border border-[#C7D4D1] bg-white px-4 py-2 text-sm font-bold hover:bg-[#F0F4F3]">Voltar</Link>
            <Link href="/admin/settings/vital" className="rounded-xl bg-[#173C35] px-4 py-2 text-sm font-bold text-white hover:bg-[#0D7166]">Cadastrar chaves</Link>
          </div>
        </div>

        {searchParams?.google === 'connected' && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Google Workspace conectado. A agenda futura será sincronizada automaticamente.</div>}
        {searchParams?.error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">Falha na integração: {searchParams.error}</div>}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-[#D3DEDB] bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-[#6B7975]">Google Agenda</p><p className="mt-2 text-2xl font-black">{googleConnected ? 'Conectado' : 'Aguardando OAuth'}</p><p className="mt-2 text-sm text-[#5C6B67]">{synced} eventos sincronizados · {pending} pendentes</p></div>
          <div className="rounded-3xl border border-[#D3DEDB] bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-[#6B7975]">WhatsApp</p><p className="mt-2 text-2xl font-black capitalize">{channel?.whatsapp_activation_state || 'draft'}</p><p className="mt-2 text-sm text-[#5C6B67]">{channel?.whatsapp_pilot_mode ? 'Modo piloto ativo' : 'Modo live'}</p></div>
          <div className="rounded-3xl border border-[#D3DEDB] bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-[#6B7975]">Segurança</p><p className="mt-2 text-2xl font-black">Vault</p><p className="mt-2 text-sm text-[#5C6B67]">Tokens privados não retornam ao navegador.</p></div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {PROVIDERS.map(provider => {
            const providerRows = byProvider.get(provider.id) || new Map<string,string>()
            const complete = provider.keys.every(k => providerRows.has(k))
            const valid = Array.from(providerRows.values()).some(v => v === 'valid')
            const googleReadyForOAuth = provider.id === 'google_workspace' && complete
            return (
              <article key={provider.id} className="rounded-3xl border border-[#D3DEDB] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E2F3EF] font-black text-[#0D7166]">{provider.icon}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{provider.title}</h2>{provider.essential && <span className="rounded-full border border-[#B8DED5] bg-[#E2F3EF] px-2 py-0.5 text-[10px] font-black text-[#0D7166]">Essencial</span>}</div>
                      <p className="mt-1 text-xs text-[#667570]">{provider.subtitle}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${valid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : complete ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-[#D3DEDB] bg-[#F0F4F3] text-[#52615D]'}`}>{valid ? 'Validado' : complete ? 'Configurado' : 'Incompleto'}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-[#E0E8E6] pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/settings/vital#${provider.id}`} className="rounded-xl bg-[#173C35] px-3 py-2 text-xs font-black text-white hover:bg-[#0D7166]">Configurar</Link>
                    {provider.id === 'google_workspace' && !googleConnected && <Link href="/api/admin/integrations/google/connect" aria-disabled={!googleReadyForOAuth} className={`rounded-xl px-3 py-2 text-xs font-black ${googleReadyForOAuth ? 'bg-[#118C7E] text-white hover:bg-[#0D7166]' : 'pointer-events-none bg-[#E4EBE9] text-[#7A8884]'}`}>Conectar Google</Link>}
                    {provider.id === 'google_workspace' && googleConnected && <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">OAuth conectado</span>}
                    {'action' in provider && provider.action && <Link href={provider.action} className="rounded-xl border border-[#C7D4D1] bg-white px-3 py-2 text-xs font-black hover:bg-[#F0F4F3]">{provider.actionLabel}</Link>}
                  </div>
                  <IntegrationTestButton provider={provider.id} disabled={!complete || (provider.id === 'google_workspace' && !googleConnected)} />
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
