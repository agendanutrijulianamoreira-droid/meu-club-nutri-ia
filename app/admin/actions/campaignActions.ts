"use server"

import { createClient } from "@supabase/supabase-js"
import { cookies } from 'next/headers'

// Use Service Role Client for processing (bypassing RLS for internal logic)
// BUT we MUST validate the user session/permissions first manually.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function processCampaignAction(campaignId: string) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    try {
        // --- 1. MANDATORY PERMISSION CHECK ---
        // Get the actual user from the token in cookies
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error("Não autorizado")

        // Fetch user profile to verify tenant and role
        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id, role')
            .eq('user_id', user.id)
            .single()

        if (!profile || (profile.role !== 'admin' && profile.role !== 'nutritionist')) {
            throw new Error("Permissão negada")
        }

        // --- 2. FETCH CAMPAIGN & VALIDATE OWNERSHIP ---
        const { data: campaign, error: cError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single()

        if (cError || !campaign) throw new Error("Campanha não encontrada")

        // Block if campaign doesn't belong to the user's tenant
        if (campaign.tenant_id !== profile.tenant_id) {
            throw new Error("Você não tem permissão para processar esta campanha")
        }

        if (campaign.status === 'sent') return { success: true, message: 'Já enviada' }

        // Update status to sending
        await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaignId)

        // --- 3. RESOLVE RECIPIENTS (FILTERED BY ROLE='patient') ---
        let userIds: string[] = []
        if (campaign.segment?.type === 'all') {
            const { data } = await supabase
                .from('profiles')
                .select('user_id')
                .eq('tenant_id', campaign.tenant_id)
                .eq('role', 'patient')
            userIds = data?.map(d => d.user_id) || []
        } else if (campaign.segment?.type === 'low_adherence') {
            const days = campaign.segment?.days || 3
            // Assuming get_inactive_users RPC exists or manual logic
            const { data } = await supabase.rpc('get_inactive_users', {
                p_tenant_id: campaign.tenant_id,
                p_days: days
            })
            userIds = data?.filter((d: any) => d.role === 'patient').map((d: any) => d.user_id) || []
        }

        // --- 4. IDEMPOTENT PROCESSING ---
        // We process in batch or iterative with upsert to avoid duplication on refresh
        for (const userId of userIds) {
            // Recipient Record (Dedupe)
            await supabase.from('campaign_recipients').upsert(
                { campaign_id: campaignId, user_id: userId, status: 'sent' },
                { onConflict: 'campaign_id,user_id' }
            )

            // Internal Notification (Inbox Dedupe)
            await supabase.from('notifications').upsert(
                {
                    tenant_id: campaign.tenant_id,
                    user_id: userId,
                    campaign_id: campaignId,
                    title: campaign.title,
                    body: campaign.body,
                    cta_label: campaign.cta_label,
                    cta_url: campaign.cta_url,
                    is_read: false
                },
                { onConflict: 'campaign_id,user_id' }
            )
        }

        // --- 5. FINALIZE ---
        const { error: finalError } = await supabase.from('campaigns')
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
        await supabase.from('campaigns')
            .update({ status: 'failed' })
            .eq('id', campaignId)
            .neq('status', 'sent')

        return { success: false, error: error.message }
    }
}
