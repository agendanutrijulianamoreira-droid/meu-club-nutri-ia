"use server"

import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from 'next/headers'
import { z } from "zod"
import { sendPushToUser } from "@/lib/onesignal"

// Use Service Role Client for processing (bypassing RLS for internal logic)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const campaignIdSchema = z.string().uuid('ID da campanha inválido')

export async function processCampaignAction(campaignId: string) {
    const parsed = campaignIdSchema.safeParse(campaignId)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || 'ID inválido' }
    }
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

        // --- C. FETCH CAMPAIGN ---
        const { data: campaign, error: cError } = await cookieSupabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single()

        if (cError || !campaign) throw new Error("Campanha não encontrada ou acesso negado.")

        // --- D. STATE MACHINE PROTECTION (ATOMIC UPDATE) ---
        const { data: updatedCampaign, error: statusUpdateError } = await adminSupabase
            .from('campaigns')
            .update({ status: 'sending' })
            .eq('id', campaignId)
            .in('status', ['draft', 'scheduled'])
            .select('id, tenant_id, title, body, cta_label, cta_url, segment, channels')
            .single()

        if (statusUpdateError || !updatedCampaign) {
            // Check if it was already sent or is already sending
            const { data: current } = await adminSupabase.from('campaigns').select('status').eq('id', campaignId).single()
            if (current?.status === 'sent') return { success: true, message: 'Campanha já foi enviada.' }
            if (current?.status === 'sending') return { success: false, error: 'Campanha já está em processamento.' }
            return { success: false, error: "Campanha não pode ser enviada neste estado." }
        }

        try {
            // --- E. RESOLVE RECIPIENTS (STRICT PATIENT FILTERING) ---
            let userIds: string[] = []
            const campaignData = updatedCampaign // Use snapshot from atomic update

            if (campaignData.segment?.type === 'all') {
                const { data: patients } = await adminSupabase
                    .from('profiles')
                    .select('user_id')
                    .eq('tenant_id', campaignData.tenant_id)
                    .eq('role', 'patient')
                userIds = patients?.map(d => d.user_id) || []
            } else if (campaignData.segment?.type === 'low_adherence') {
                const days = campaignData.segment?.days || 3
                // RPC should return candidate IDs, then we re-verify roles and tenant
                const { data: candidateIds } = await adminSupabase.rpc('get_inactive_users', {
                    p_tenant_id: campaignData.tenant_id,
                    p_days: days
                })

                if (candidateIds && candidateIds.length > 0) {
                    const rawIds = candidateIds.map((d: any) => typeof d === 'string' ? d : d.user_id)
                    const { data: verifiedPatients } = await adminSupabase
                        .from('profiles')
                        .select('user_id')
                        .in('user_id', rawIds)
                        .eq('tenant_id', campaignData.tenant_id)
                        .eq('role', 'patient')
                    userIds = verifiedPatients?.map(d => d.user_id) || []
                }
            }

            if (userIds.length === 0) {
                await adminSupabase.from('campaigns').update({ status: 'draft', sent_at: null }).eq('id', campaignId)
                return { success: true, count: 0, message: "Nenhum destinatário encontrado para os filtros selecionados." }
            }

            // --- G. IDEMPOTENT BATCH UPSERT ---
            const recipientRecords = userIds.map(uid => ({
                campaign_id: campaignId,
                user_id: uid,
                status: 'sent'
            }))

            const inboxRecords = userIds.map(uid => ({
                tenant_id: campaignData.tenant_id,
                user_id: uid,
                agent_name: 'campaign',
                title: campaignData.title,
                body: campaignData.body,
                message_type: 'campaign',
                priority: 'normal',
                cta_label: campaignData.cta_label,
                cta_url: campaignData.cta_url,
                channels: ['inbox'],
                metadata: { campaign_id: campaignId },
            }))

            // Run inbox + recipients operations
            await Promise.all([
                adminSupabase.from('campaign_recipients').upsert(recipientRecords, { onConflict: 'campaign_id,user_id' }),
                adminSupabase.from('inbox_messages').insert(inboxRecords)
            ])

            // Send push via OneSignal when channel is enabled (fire-and-forget, non-blocking)
            if (campaignData.channels?.push) {
                await Promise.allSettled(
                    userIds.map(uid =>
                        sendPushToUser({
                            externalUserId: uid,
                            title: campaignData.title,
                            message: campaignData.body,
                            url: campaignData.cta_url || undefined,
                            data: { campaign_id: campaignId },
                        }).catch(err => console.error(`[Campaign] Push failed for ${uid}:`, err))
                    )
                )
            }

            // --- H. FINALIZE ---
            await adminSupabase.from('campaigns')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString()
                })
                .eq('id', campaignId)

            return { success: true, count: userIds.length }

        } catch (processError: any) {
            console.error("Critical failure in campaign processing:", processError)
            // Set back to failed but allow retry if not 'sent'
            await adminSupabase.from('campaigns')
                .update({ status: 'failed' })
                .eq('id', campaignId)
                .neq('status', 'sent')
            throw processError
        }
    } catch (authErr: any) {
        // Auth or permission errors should NOT mark campaign as failed in most cases, 
        // just return the error to the caller.
        console.warn("Auth/Permission error in campaign action:", authErr.message)
        return { success: false, error: authErr.message }
    }
}
