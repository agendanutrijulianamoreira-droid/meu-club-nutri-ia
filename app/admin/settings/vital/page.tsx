import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const STAFF = ['admin', 'nutritionist', 'nutri']

type Field = {
  category: string
  provider: string
  key: string
  label: string
  description: string
  type: 'secret' | 'text' | 'url' | 'boolean' | 'json'
  required?: boolean
  placeholder?: string
}

type Group = {
  id: string
  title: string
  subtitle: string
  icon: string
  priority: 'Essencial' | 'Recomendado' | 'Opcional'
  fields: Field[]
}

const GROUPS: Group[] = [
  {
    id: 'whatsapp',
    title: 'WhatsApp · Meta Cloud API',
    subtitle: 'Confirmação, lembretes, reagendamento e atendimento bidirecional.',
    icon: 'WA',
    priority: 'Essencial',
    fields: [
      { category: 'Comunicação', provider: 'meta_whatsapp', key: 'PHONE_NUMBER_ID', label: 'Phone Number ID', description: 'ID do número cadastrado no WhatsApp Business Platform.', type: 'text', required: true },
      { category: 'Comunicação', provider: 'meta_whatsapp', key: 'WABA_ID', label: 'WABA ID', description: 'ID da conta WhatsApp Business.', type: 'text', required: true },
      { category: 'Comunicação', provider: 'meta_whatsapp', key: 'GRAPH_VERSION', label: 'Graph API', description: 'Versão da Graph API utilizada pelo adapter.', type: 'text', placeholder: 'v26.0' },
      { category: 'Comunicação', provider: 'meta_whatsapp', key: 'ACCESS_TOKEN', label: 'Access Token permanente', description: 'Token de System User armazenado apenas no Vault.', type: 'secret', required: true },
      { category: 'Comunicação', provider: 'meta_whatsapp', key: 'WEBHOOK_VERIFY_TOKEN', label: 'Webhook Verify Token', description: 'Token da verificação inicial do webhook.', type: 'secret', required: true },
      { category: 'Comunicação', provider: 'meta_whatsapp', key: 'APP_SECRET', label: 'App Secret', description: 'Assina e valida eventos recebidos da Meta.', type: 'secret', required: true },
    ],
  },
  {
    id: 'google-workspace',
    title: 'Google Workspace · Agenda, Meet e Drive',
    subtitle: 'Evita conflitos de agenda, gera links de consulta e organiza documentos clínicos.',
    icon: 'G',
    priority: 'Essencial',
    fields: [
      { category: 'Produtividade', provider: 'google_workspace', key: 'CLIENT_ID', label: 'OAuth Client ID', description: 'Credencial OAuth do projeto Google usado pela clínica.', type: 'text', required: true },
      { category: 'Produtividade', provider: 'google_workspace', key: 'CLIENT_SECRET', label: 'OAuth Client Secret', description: 'Segredo OAuth, protegido no Vault.', type: 'secret', required: true },
      { category: 'Produtividade', provider: 'google_workspace', key: 'CALENDAR_ID', label: 'Calendário principal', description: 'ID do calendário que receberá as consultas.', type: 'text', placeholder: 'primary' },
      { category: 'Produtividade', provider: 'google_workspace', key: 'DRIVE_FOLDER_ID', label: 'Pasta clínica no Drive', description: 'Pasta opcional para documentos e materiais gerados pelo sistema.', type: 'text' },
    ],
  },
  {
    id: 'video',
    title: 'Videoconsulta · Google Meet / Zoom',
    subtitle: 'Criação automática de sala online vinculada ao agendamento.',
    icon: 'VC',
    priority: 'Recomendado',
    fields: [
      { category: 'Atendimento', provider: 'zoom', key: 'ACCOUNT_ID', label: 'Zoom Account ID', description: 'Conta Server-to-Server OAuth, caso use Zoom em vez de Meet.', type: 'text' },
      { category: 'Atendimento', provider: 'zoom', key: 'CLIENT_ID', label: 'Zoom Client ID', description: 'Identificador do app Zoom.', type: 'text' },
      { category: 'Atendimento', provider: 'zoom', key: 'CLIENT_SECRET', label: 'Zoom Client Secret', description: 'Segredo do app Zoom armazenado no Vault.', type: 'secret' },
    ],
  },
  {
    id: 'ai',
    title: 'Inteligência Artificial · Google Gemini',
    subtitle: 'Motor de IA do sistema para agentes, cardápios, análises e conteúdo.',
    icon: 'AI',
    priority: 'Essencial',
    fields: [
      { category: 'Inteligência Artificial', provider: 'gemini', key: 'API_KEY', label: 'Gemini API Key', description: 'Chave privada usada pelas rotas e agentes de IA.', type: 'secret', required: true },
      { category: 'Inteligência Artificial', provider: 'gemini', key: 'MODEL', label: 'Modelo padrão', description: 'Fallback para recursos sem modelo definido.', type: 'text', placeholder: 'gemini-2.5-flash' },
    ],
  },
  {
    id: 'email',
    title: 'E-mail transacional · Resend',
    subtitle: 'Confirmações, alertas, recuperação de acesso e mensagens operacionais.',
    icon: '@',
    priority: 'Recomendado',
    fields: [
      { category: 'Comunicação', provider: 'resend', key: 'API_KEY', label: 'Resend API Key', description: 'Chave privada do provedor de e-mail.', type: 'secret' },
      { category: 'Comunicação', provider: 'resend', key: 'FROM_EMAIL', label: 'E-mail remetente', description: 'Remetente autorizado no provedor.', type: 'text', placeholder: 'contato@seudominio.com.br' },
      { category: 'Comunicação', provider: 'resend', key: 'FROM_NAME', label: 'Nome do remetente', description: 'Nome exibido para pacientes e leads.', type: 'text', placeholder: 'Sua Clínica' },
    ],
  },
  {
    id: 'asaas',
    title: 'Pagamentos · Asaas',
    subtitle: 'Cobrança nacional, Pix, cartão, boleto, recorrência e conciliação.',
    icon: 'A$',
    priority: 'Recomendado',
    fields: [
      { category: 'Financeiro', provider: 'asaas', key: 'API_KEY', label: 'Asaas API Key', description: 'Credencial privada da conta Asaas.', type: 'secret' },
      { category: 'Financeiro', provider: 'asaas', key: 'BASE_URL', label: 'Ambiente Asaas', description: 'Endpoint de produção ou sandbox.', type: 'url', placeholder: 'https://api.asaas.com/v3' },
      { category: 'Financeiro', provider: 'asaas', key: 'WEBHOOK_TOKEN', label: 'Token do webhook', description: 'Token para validar notificações financeiras recebidas.', type: 'secret' },
    ],
  },
  {
    id: 'mercadopago',
    title: 'Pagamentos · Mercado Pago',
    subtitle: 'Alternativa para Pix, cartão e links de pagamento no Brasil.',
    icon: 'MP',
    priority: 'Opcional',
    fields: [
      { category: 'Financeiro', provider: 'mercadopago', key: 'ACCESS_TOKEN', label: 'Access Token', description: 'Token privado da aplicação Mercado Pago.', type: 'secret' },
      { category: 'Financeiro', provider: 'mercadopago', key: 'PUBLIC_KEY', label: 'Public Key', description: 'Chave pública utilizada no checkout.', type: 'text' },
      { category: 'Financeiro', provider: 'mercadopago', key: 'WEBHOOK_SECRET', label: 'Webhook Secret', description: 'Segredo para validar notificações recebidas.', type: 'secret' },
    ],
  },
  {
    id: 'stripe',
    title: 'Pagamentos · Stripe',
    subtitle: 'Checkout e assinaturas quando houver necessidade de infraestrutura global.',
    icon: 'S$',
    priority: 'Opcional',
    fields: [
      { category: 'Financeiro', provider: 'stripe', key: 'SECRET_KEY', label: 'Secret Key', description: 'Chave privada da conta Stripe.', type: 'secret' },
      { category: 'Financeiro', provider: 'stripe', key: 'PUBLISHABLE_KEY', label: 'Publishable Key', description: 'Chave pública utilizada no checkout.', type: 'text' },
      { category: 'Financeiro', provider: 'stripe', key: 'WEBHOOK_SECRET', label: 'Webhook Secret', description: 'Segredo de assinatura dos webhooks Stripe.', type: 'secret' },
    ],
  },
  {
    id: 'signature',
    title: 'Assinatura digital · Clicksign / ZapSign',
    subtitle: 'Termos, contratos e consentimentos sem papel ou envio manual.',
    icon: '✓',
    priority: 'Recomendado',
    fields: [
      { category: 'Documentos', provider: 'signature', key: 'PROVIDER', label: 'Provedor', description: 'clicksign ou zapsign.', type: 'text', placeholder: 'clicksign' },
      { category: 'Documentos', provider: 'signature', key: 'API_KEY', label: 'API Key', description: 'Credencial privada do provedor escolhido.', type: 'secret' },
      { category: 'Documentos', provider: 'signature', key: 'WEBHOOK_SECRET', label: 'Webhook Secret', description: 'Validação dos eventos de assinatura.', type: 'secret' },
    ],
  },
  {
    id: 'automation',
    title: 'Automação · n8n e Webhooks',
    subtitle: 'Conecta serviços externos sem criar uma integração específica para cada rotina.',
    icon: '<>',
    priority: 'Recomendado',
    fields: [
      { category: 'Automação', provider: 'automation', key: 'N8N_BASE_URL', label: 'n8n Base URL', description: 'URL-base da instância de automação.', type: 'url' },
      { category: 'Automação', provider: 'automation', key: 'N8N_API_KEY', label: 'n8n API Key', description: 'Credencial privada quando a automação exigir autenticação.', type: 'secret' },
      { category: 'Automação', provider: 'automation', key: 'OUTBOUND_WEBHOOK_URL', label: 'Webhook operacional', description: 'Endpoint opcional para integrações personalizadas.', type: 'url' },
    ],
  },
]

async function viewer() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('tenant_id,role,name').eq('user_id', user.id).maybeSingle()
  if (!profile?.tenant_id || !STAFF.includes(String(profile.role || '').toLowerCase())) redirect('/patient/home')
  return { supabase, tenantId: profile.tenant_id, name: profile.name || user.email || 'Admin' }
}

async function saveSetting(form: FormData) {
  'use server'
  const { supabase } = await viewer()
  const value = String(form.get('value') || '')
  const type = String(form.get('type') || 'text')
  if (type === 'secret' && !value) redirect('/admin/settings/vital?error=empty_secret')
  const { error } = await supabase.rpc('upsert_tenant_vital_setting', {
    p_category: String(form.get('category') || 'Geral'),
    p_provider: String(form.get('provider') || ''),
    p_setting_key: String(form.get('key') || ''),
    p_label: String(form.get('label') || ''),
    p_description: String(form.get('description') || ''),
    p_value_type: type,
    p_value: value,
    p_required: form.get('required') === 'true',
    p_enabled: true,
  })
  if (error) redirect('/admin/settings/vital?error=save')
  revalidatePath('/admin/settings/vital')
  redirect('/admin/settings/vital?saved=1')
}

async function saveCustom(form: FormData) {
  'use server'
  const { supabase } = await viewer()
  const provider = String(form.get('provider') || 'custom').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  const key = String(form.get('key') || '').trim().toUpperCase().replace(/[^A-Z0-9_.-]/g, '_')
  const type = String(form.get('type') || 'secret')
  const value = String(form.get('value') || '')
  if (provider.length < 2 || key.length < 2 || !value) redirect('/admin/settings/vital?error=custom')
  const { error } = await supabase.rpc('upsert_tenant_vital_setting', {
    p_category: 'Personalizada', p_provider: provider, p_setting_key: key,
    p_label: String(form.get('label') || key).trim(), p_description: String(form.get('description') || ''),
    p_value_type: type, p_value: value, p_required: false, p_enabled: true,
  })
  if (error) redirect('/admin/settings/vital?error=custom')
  revalidatePath('/admin/settings/vital')
  redirect('/admin/settings/vital?saved=custom')
}

function statusClass(status: string) {
  if (status === 'valid') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (status === 'configured') return 'bg-amber-50 text-amber-900 border-amber-200'
  if (status === 'invalid') return 'bg-red-50 text-red-800 border-red-200'
  return 'bg-[#F0F4F3] text-[#52615D] border-[#D3DEDB]'
}

function statusLabel(status: string) {
  if (status === 'valid') return 'Validado'
  if (status === 'configured') return 'Configurado'
  if (status === 'invalid') return 'Inválido'
  if (status === 'needs_review') return 'Revisar'
  return 'Ausente'
}

function priorityClass(priority: Group['priority']) {
  if (priority === 'Essencial') return 'bg-[#E2F3EF] text-[#0D7166] border-[#B8DED5]'
  if (priority === 'Recomendado') return 'bg-amber-50 text-amber-900 border-amber-200'
  return 'bg-[#F0F4F3] text-[#52615D] border-[#D3DEDB]'
}

export default async function VitalSettings({ searchParams }: { searchParams?: { saved?: string; error?: string } }) {
  const { supabase, tenantId, name } = await viewer()
  const [{ data: rows }, { data: tenant }, { data: channel }] = await Promise.all([
    supabase.from('tenant_vital_settings').select('provider,setting_key,label,value_type,config_value,required,enabled,validation_status,last_validated_at,updated_at').eq('tenant_id', tenantId),
    supabase.from('tenants').select('brand_name,slug,plan_tier').eq('id', tenantId).maybeSingle(),
    supabase.from('appointment_communication_channel_settings').select('whatsapp_activation_state,whatsapp_pilot_mode').eq('tenant_id', tenantId).maybeSingle(),
  ])

  const map = new Map((rows || []).map((r: any) => [`${r.provider}:${r.setting_key}`, r]))
  const catalogKeys = new Set(GROUPS.flatMap(g => g.fields.map(f => `${f.provider}:${f.key}`)))
  const custom = (rows || []).filter((r: any) => !catalogKeys.has(`${r.provider}:${r.setting_key}`) && r.provider !== 'webdiet')
  const requiredFields = GROUPS.flatMap(g => g.fields).filter(f => f.required)
  const configuredRequired = requiredFields.filter(f => map.has(`${f.provider}:${f.key}`)).length
  const configuredGroups = GROUPS.filter(g => g.fields.some(f => map.has(`${f.provider}:${f.key}`))).length

  return (
    <main className="min-h-screen bg-[#F4F7F6] text-[#1C2B27]">
      <div className="mx-auto max-w-7xl px-4 md:px-7 py-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#0D7166]">Configurações · Integrações</p>
            <h1 className="mt-1 text-3xl font-black">Central de serviços vitais</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#5C6B67]">Conecte apenas ferramentas que reduzam trabalho operacional. Segredos ficam criptografados no Supabase Vault e nunca são exibidos novamente.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin" className="rounded-xl border border-[#C7D4D1] bg-white px-4 py-2 text-sm font-bold text-[#1C2B27] hover:bg-[#F0F4F3]">Voltar ao Admin</Link>
            <Link href="/admin/appointments/communications/whatsapp/go-live" className="rounded-xl bg-[#118C7E] px-4 py-2 text-sm font-bold text-white hover:bg-[#0D7166]">Go-live WhatsApp</Link>
          </div>
        </div>

        {searchParams?.saved && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Configuração salva com segurança.</div>}
        {searchParams?.error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">Não foi possível salvar. Revise os dados e tente novamente.</div>}

        <section className="mb-6 grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="overflow-hidden rounded-3xl border border-[#D3DEDB] bg-white shadow-sm">
            <div className="bg-[#173C35] p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#A9D8CD]">Clínica</p>
              <p className="mt-3 text-xl font-black">{tenant?.brand_name || 'Minha clínica'}</p>
            </div>
            <div className="p-5 text-sm">
              <p className="font-black">{name}</p>
              <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-[#6B7975]">Plano</p>
              <p>{tenant?.plan_tier || '—'}</p>
              <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[#6B7975]">WhatsApp</p>
              <p className="font-bold">{channel?.whatsapp_activation_state || 'draft'} {channel?.whatsapp_pilot_mode ? '· piloto' : ''}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-[#D3DEDB] bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#6B7975]">Prontidão essencial</p>
              <p className="mt-2 text-4xl font-black">{configuredRequired}/{requiredFields.length}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E4EBE9]"><div className="h-full bg-[#118C7E]" style={{ width: `${requiredFields.length ? configuredRequired / requiredFields.length * 100 : 0}%` }} /></div>
            </div>
            <div className="rounded-3xl border border-[#D3DEDB] bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#6B7975]">Segredos protegidos</p>
              <p className="mt-2 text-4xl font-black">{(rows || []).filter((r: any) => r.value_type === 'secret').length}</p>
              <p className="mt-3 text-sm text-[#5C6B67]">Valores permanecem somente no Vault.</p>
            </div>
            <div className="rounded-3xl border border-[#D3DEDB] bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#6B7975]">Serviços iniciados</p>
              <p className="mt-2 text-4xl font-black">{configuredGroups}/{GROUPS.length}</p>
              <p className="mt-3 text-sm text-[#5C6B67]">Com pelo menos uma configuração cadastrada.</p>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          {GROUPS.map(group => {
            const groupConfigured = group.fields.filter(f => map.has(`${f.provider}:${f.key}`)).length
            return (
              <section key={group.id} className="rounded-3xl border border-[#D3DEDB] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E2F3EF] font-black text-[#0D7166]">{group.icon}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black">{group.title}</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${priorityClass(group.priority)}`}>{group.priority}</span>
                      </div>
                      <p className="mt-1 text-sm text-[#5C6B67]">{group.subtitle}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#D3DEDB] bg-[#F4F7F6] px-3 py-1 text-xs font-black text-[#52615D]">{groupConfigured}/{group.fields.length} configurados</span>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {group.fields.map(field => {
                    const row: any = map.get(`${field.provider}:${field.key}`)
                    return (
                      <form action={saveSetting} key={`${field.provider}:${field.key}`} className="rounded-2xl border border-[#DCE5E3] bg-[#F9FBFA] p-4">
                        <input type="hidden" name="category" value={field.category} />
                        <input type="hidden" name="provider" value={field.provider} />
                        <input type="hidden" name="key" value={field.key} />
                        <input type="hidden" name="label" value={field.label} />
                        <input type="hidden" name="description" value={field.description} />
                        <input type="hidden" name="type" value={field.type} />
                        <input type="hidden" name="required" value={String(Boolean(field.required))} />
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black">{field.label}{field.required && <span className="ml-1 text-red-500">*</span>}</p>
                            <p className="mt-1 text-xs leading-relaxed text-[#667570]">{field.description}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(row?.validation_status || 'unknown')}`}>{statusLabel(row?.validation_status || 'unknown')}</span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input
                            name="value"
                            type={field.type === 'secret' ? 'password' : field.type === 'url' ? 'url' : 'text'}
                            defaultValue={field.type === 'secret' ? '' : row?.config_value || ''}
                            placeholder={field.type === 'secret' && row ? '••••••••  (substituir)' : field.placeholder || (field.type === 'secret' ? 'Cole o segredo' : '')}
                            className="min-w-0 flex-1 rounded-xl border border-[#C7D4D1] bg-white px-3 py-2.5 text-sm text-[#1C2B27] placeholder:text-[#71807C] focus:border-[#118C7E] focus:outline-none"
                          />
                          <button className="rounded-xl bg-[#173C35] px-4 py-2.5 text-xs font-black text-white hover:bg-[#0D7166]">{row ? 'Atualizar' : 'Salvar'}</button>
                        </div>
                      </form>
                    )
                  })}
                </div>
              </section>
            )
          })}

          <section className="rounded-3xl border border-dashed border-[#B7C8C4] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Integração personalizada</h2>
            <p className="mt-1 text-sm text-[#5C6B67]">Cadastre qualquer serviço futuro sem precisar alterar o schema.</p>
            <form action={saveCustom} className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <input name="provider" placeholder="Provedor (ex: canva)" className="rounded-xl border border-[#C7D4D1] bg-white px-3 py-2.5 text-sm" />
              <input name="key" placeholder="Chave (ex: API_KEY)" className="rounded-xl border border-[#C7D4D1] bg-white px-3 py-2.5 text-sm font-mono" />
              <input name="label" placeholder="Nome do campo" className="rounded-xl border border-[#C7D4D1] bg-white px-3 py-2.5 text-sm" />
              <select name="type" className="rounded-xl border border-[#C7D4D1] bg-white px-3 py-2.5 text-sm"><option value="secret">Segredo</option><option value="text">Texto</option><option value="url">URL</option></select>
              <div className="flex gap-2"><input name="value" type="password" placeholder="Valor" className="min-w-0 flex-1 rounded-xl border border-[#C7D4D1] bg-white px-3 py-2.5 text-sm" /><button className="rounded-xl bg-[#118C7E] px-4 py-2.5 text-xs font-black text-white">Adicionar</button></div>
            </form>
            {custom.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{custom.map((r: any) => <span key={`${r.provider}:${r.setting_key}`} className="rounded-full border border-[#D3DEDB] bg-[#F4F7F6] px-3 py-1 text-xs font-bold text-[#52615D]">{r.provider} · {r.label || r.setting_key}</span>)}</div>}
          </section>
        </div>
      </div>
    </main>
  )
}
