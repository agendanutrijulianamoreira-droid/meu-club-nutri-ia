import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Security check: Only allow service role or authenticated admin
        // For MVP, we presume this is called by a secure internal cron or specific admin route
        const { campaign_id, process_all } = await req.json()

        if (process_all) {
            return await handleAllScheduled(supabase)
        }

        if (campaign_id) {
            const result = await processCampaign(supabase, campaign_id)
            return new Response(JSON.stringify(result), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        return new Response(JSON.stringify({ error: 'Missing campaign_id or process_all' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})

async function handleAllScheduled(supabase: any) {
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('id')
        .eq('status', 'scheduled')
        .lte('scheduled_for', new Date().toISOString())

    if (error) throw error

    const results = []
    for (const campaign of campaigns || []) {
        try {
            const res = await processCampaign(supabase, campaign.id)
            results.push(res)
        } catch (err) {
            results.push({ campaign_id: campaign.id, error: err.message })
        }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    })
}

async function processCampaign(supabase: any, campaignId: string) {
    // 1. Get Campaign Details
    const { data: campaign, error: cError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

    if (cError || !campaign) throw new Error('Campaign not found')

    // Only process if status is 'scheduled' or it's being re-tried
    if (campaign.status === 'sent' || campaign.status === 'sending') {
        return { campaign_id: campaignId, status: 'already_processed' }
    }

    // Update status to sending
    await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaignId)

    try {
        // 2. Resolve Recipients based on segment (filtered by role='patient')
        const userIds = await resolveSegment(supabase, campaign.tenant_id, campaign.segment)

        // 3. Process each recipient
        const inboxEnabled = campaign.channels?.inbox

        let successCount = 0
        let failureCount = 0

        for (const userId of userIds) {
            try {
                // Idempotency: Create Recipient record (UNIQUE constraint)
                const { error: rError } = await supabase
                    .from('campaign_recipients')
                    .insert({ campaign_id: campaignId, user_id: userId })

                if (rError && rError.code !== '23505') throw rError

                // Inbox Notification (Idempotency via UNIQUE constraint)
                if (inboxEnabled) {
                    const { error: nError } = await supabase
                        .from('notifications')
                        .insert({
                            tenant_id: campaign.tenant_id,
                            user_id: userId,
                            campaign_id: campaignId,
                            title: campaign.title,
                            body: campaign.body,
                            cta_label: campaign.cta_label,
                            cta_url: campaign.cta_url
                        })

                    if (nError && nError.code !== '23505') throw nError
                }

                await supabase.from('campaign_recipients')
                    .update({ status: 'sent' })
                    .match({ campaign_id: campaignId, user_id: userId })

                successCount++
            } catch (err) {
                console.error(`Error processing recipient ${userId}:`, err)
                await supabase.from('campaign_recipients')
                    .update({ status: 'failed', error: err.message })
                    .match({ campaign_id: campaignId, user_id: userId })
                failureCount++
            }
        }

        // 4. Update Campaign final status
        await supabase.from('campaigns')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('id', campaignId)

        return { campaign_id: campaignId, success: successCount, failure: failureCount }

    } catch (error) {
        await supabase.from('campaigns').update({ status: 'failed' }).eq('id', campaignId)
        throw error
    }
}

async function resolveSegment(supabase: any, tenantId: string, segment: any) {
    if (segment.type === 'all') {
        const { data } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('tenant_id', tenantId)
            .eq('role', 'patient') // Strictly patients
        return data?.map((d: any) => d.user_id) || []
    }

    if (segment.type === 'low_adherence') {
        const days = segment.days || 3
        const { data } = await supabase.rpc('get_inactive_users', {
            p_tenant_id: tenantId,
            p_days: days
        })
        return data?.map((d: any) => d.user_id) || []
    }

    return []
}
