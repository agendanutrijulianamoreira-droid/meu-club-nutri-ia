import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function localDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default async function FollowupsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: viewer } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = String(viewer?.role || '').toLowerCase()
  if (!viewer?.tenant_id || !['admin', 'nutritionist', 'nutri'].includes(role)) {
    redirect('/patient/home')
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (serviceRoleKey && supabaseUrl) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const today = localDate()

    const { error: snapshotError } = await admin.rpc('refresh_patient_operational_snapshot', {
      p_tenant_id: viewer.tenant_id,
      p_reference_date: today,
    })

    if (!snapshotError) {
      await Promise.all([
        admin.rpc('sync_patient_followup_tasks', {
          p_tenant_id: viewer.tenant_id,
          p_reference_date: today,
        }),
        admin.rpc('sync_phase_review_tasks', {
          p_tenant_id: viewer.tenant_id,
          p_reference_date: today,
        }),
        admin.rpc('sync_checkin_feedback_tasks', {
          p_tenant_id: viewer.tenant_id,
          p_reference_date: today,
        }),
      ])

      await admin.rpc('apply_followup_exit_rules', {
        p_tenant_id: viewer.tenant_id,
      })
    }
  }

  return (
    <>
      {children}
      <Link href="/admin/followups/history" className="fixed bottom-5 left-5 z-[90] rounded-xl border border-white/10 bg-slate-900/95 px-4 py-2 text-xs font-black text-slate-100 shadow-2xl">
        Histórico de intervenções
      </Link>
    </>
  )
}
