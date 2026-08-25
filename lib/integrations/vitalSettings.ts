import 'server-only'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const STAFF = new Set(['admin', 'nutritionist', 'nutri'])

export async function requireStaffIntegrationContext() {
  const cookieStore = cookies()
  const supabase = createSupabaseServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Object.assign(new Error('unauthenticated'), { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id,role,name')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = String(profile?.role || '').toLowerCase()
  if (!profile?.tenant_id || !STAFF.has(role)) {
    throw Object.assign(new Error('forbidden'), { status: 403 })
  }

  return { supabase, user, tenantId: profile.tenant_id as string, role, profile }
}

export async function getVitalConfig(tenantId: string, provider: string, key: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('tenant_vital_settings')
    .select('config_value,enabled,validation_status')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .eq('setting_key', key)
    .eq('enabled', true)
    .maybeSingle()
  if (error) throw error
  return data?.config_value ?? null
}

export async function getVitalSecret(tenantId: string, provider: string, key: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.rpc('service_get_tenant_vital_secret', {
    p_tenant_id: tenantId,
    p_provider: provider,
    p_setting_key: key,
  })
  if (error) throw error
  return (data as string | null) || null
}

export async function saveVitalSetting(
  supabase: any,
  input: {
    category: string
    provider: string
    key: string
    label: string
    description: string
    type: 'secret' | 'text' | 'url' | 'boolean' | 'json'
    value: string
    required?: boolean
  },
) {
  const { error } = await supabase.rpc('upsert_tenant_vital_setting', {
    p_category: input.category,
    p_provider: input.provider,
    p_setting_key: input.key,
    p_label: input.label,
    p_description: input.description,
    p_value_type: input.type,
    p_value: input.value,
    p_required: Boolean(input.required),
    p_enabled: true,
  })
  if (error) throw error
}

export function jsonError(error: unknown, fallback = 500) {
  const e = error as any
  const status = Number(e?.status || fallback)
  return Response.json({ error: e?.message || 'internal_error' }, { status })
}
