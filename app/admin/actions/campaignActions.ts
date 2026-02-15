"use server"

import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from 'next/headers'

// Use Service Role Client for processing (bypassing RLS for internal logic)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function processCampaignAction(campaignId: string) {
    // 1. COOKIE-BASED CLIENT FOR AUTH (SESSION VALIDATION)
    const cookieSupabase = createSupabaseServerClient(cookies())

    // Service role client for the actual heavy lifting/upserts
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    try {
        // --- A. GET USER SESSION ---
        const { data: { user }, error: authError } = await cookieSupabase.auth.getUser()
        if (authError || !user) throw new Error("Não autorizado")

        // --- B. VALIDATE PROFILE & TENANT (VIA COOKIE CLIENT RLS) ---
        const { data: profile } = await cookieSupabase
            .from('profiles')
            .select('tenant_id, role')
            .eq('user_id', user.id)
            .single()

        const isAuthorizedRole = profile?.role === 'admin' || profile?.role === 'nutritionist';
        if (!profile || !isAuthorizedRole) {
            throw new Error("Permissão negada: Somente administradores ou nutricionistas podem gerenciar campanhas.")
        }

        // --- C. FETCH CAMPAIGN (USING SERVER CLIENT TO VALIDATE OWNERSHIP/RLS) ---
        const { data: campaign, error: cError } = await cookieSupabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single()

        if (cError || !campaign) throw new Error("Campanha não encontrada ou você não tem acesso.")

        if (campaign.status === 'sent') return { success: true, message: 'Já enviada' }

        // --- D. ACTION PROCESSING (USING ADMIN SUPABASE) ---
        // Update status to sending
        await adminSupabase.from('campaigns').update({ status: 'sending' }).eq('id', campaignId)

        // --- E. RESOLVE RECIPIENTS (FILTERED BY ROLE='patient') ---
        let userIds: string[] = []
        if (campaign.segment?.type === 'all') {
            const { data } = await adminSupabase
                .from('profiles')
                .select('user_id')
                .eq('tenant_id', campaign.tenant_id)
                .eq('role', 'patient')
            userIds = data?.map(d => d.user_id) || []
        } else if (campaign.segment?.type === 'low_adherence') {
            const days = campaign.segment?.days || 3
            // RPC should already filter for patients, but we force it to be safe
            const { data } = await adminSupabase.rpc('get_inactive_users', {
                p_tenant_id: campaign.tenant_id,
                p_days: days
            })

            // If the RPC returns a list of user_ids, we verify they are indeed patients in this tenant
            if (data && data.length > 0) {
                const rawIds = data.map((d: any) => typeof d === 'string' ? d : d.user_id)
                const { data: verifiedPatients } = await adminSupabase
                    .from('profiles')
                    .select('user_id')
                    .in('user_id', rawIds)
                    .eq('tenant_id', campaign.tenant_id)
                    .eq('role', 'patient')
                userIds = verifiedPatients?.map(d => d.user_id) || []
            }
        }

        // --- F. IDEMPOTENT SENDING (BATCH UPSERT) ---
        for (const userId of userIds) {
            // Recipient Record (Dedupe)
            await adminSupabase.from('campaign_recipients').upsert(
                {
                    campaign_id: campaignId,
                    user_id: userId,
                    status: 'sent'
                },
                { onConflict: 'campaign_id,user_id' }
            )

            // Internal Notification (Inbox Dedupe)
            await adminSupabase.from('notifications').upsert(
                {
                    tenant_id: campaign.tenant_id,
                    user_id: userId,
                    campaign_id: campaignId,
                    title: campaign.title,
                    body: campaign.body,
                    cta_label: campaign.cta_label,
                    cta_url: campaign.cta_url,
                    status: 'unread',
                    read_at: null
                },
                { onConflict: 'user_id,campaign_id' }
            )
        }

        // --- G. FINALIZE ---
        const { error: finalError } = await adminSupabase.from('campaigns')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('id', campaignId)

        if (finalError) throw finalError

        return { success: true, count: userIds.length }

    } catch (error: any) {
        console.error("Error processing campaign:", error)
        // Only set failed if it wasn't already sent (to avoid overwriting success)
        await adminSupabase.from('campaigns')
            .update({ status: 'failed' })
            .eq('id', campaignId)
            .neq('status', 'sent')

        return { success: false, error: error.message }
    }
}
