/**
 * OneSignal Server-Side REST API Helper
 *
 * Required environment variables (.env.local):
 *   ONESIGNAL_APP_ID        - Your OneSignal App ID (found in Settings > Keys & IDs)
 *   ONESIGNAL_REST_API_KEY  - Your OneSignal REST API Key (found in Settings > Keys & IDs)
 *
 * Client-side (for the Web SDK hook):
 *   NEXT_PUBLIC_ONESIGNAL_APP_ID - Same App ID, exposed to the browser
 *
 * NOTE: The `profiles` table needs an `onesignal_player_id` TEXT column.
 *       Run migration: ALTER TABLE profiles ADD COLUMN onesignal_player_id TEXT;
 */

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications'

interface SendPushParams {
    playerIds?: string[]
    segments?: string[]
    title: string
    message: string
    url?: string
    data?: Record<string, any>
}

interface SendPushResult {
    success: boolean
    id?: string
    error?: string
}

interface SendPushToUserParams {
    externalUserId: string
    title: string
    message: string
    url?: string
    data?: Record<string, any>
}

/**
 * Send a push notification via OneSignal REST API v1.
 * Targets can be player IDs (specific devices) or segments (e.g. 'All').
 */
export async function sendPushNotification(params: SendPushParams): Promise<SendPushResult> {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        console.error('[OneSignal] Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY env vars')
        return { success: false, error: 'OneSignal not configured' }
    }

    const { playerIds, segments, title, message, url, data } = params

    if (!playerIds?.length && !segments?.length) {
        return { success: false, error: 'Either playerIds or segments must be provided' }
    }

    const body: Record<string, any> = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: title },
        contents: { en: message },
    }

    if (playerIds?.length) {
        body.include_player_ids = playerIds
    } else if (segments?.length) {
        body.included_segments = segments
    }

    if (url) {
        body.url = url
    }

    if (data) {
        body.data = data
    }

    try {
        const response = await fetch(ONESIGNAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(body),
        })

        const result = await response.json()

        if (!response.ok) {
            console.error('[OneSignal] API error:', result)
            return { success: false, error: result.errors?.[0] || 'OneSignal API error' }
        }

        return { success: true, id: result.id }
    } catch (err: any) {
        console.error('[OneSignal] Network error:', err)
        return { success: false, error: err.message || 'Network error' }
    }
}

/**
 * Send a push notification to a specific user by their external_user_id
 * (our Supabase user_id). OneSignal matches this to registered devices.
 */
export async function sendPushToUser(params: SendPushToUserParams): Promise<SendPushResult> {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        console.error('[OneSignal] Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY env vars')
        return { success: false, error: 'OneSignal not configured' }
    }

    const { externalUserId, title, message, url, data } = params

    const body: Record<string, any> = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: title },
        contents: { en: message },
        include_external_user_ids: [externalUserId],
    }

    if (url) {
        body.url = url
    }

    if (data) {
        body.data = data
    }

    try {
        const response = await fetch(ONESIGNAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(body),
        })

        const result = await response.json()

        if (!response.ok) {
            console.error('[OneSignal] API error:', result)
            return { success: false, error: result.errors?.[0] || 'OneSignal API error' }
        }

        return { success: true, id: result.id }
    } catch (err: any) {
        console.error('[OneSignal] Network error:', err)
        return { success: false, error: err.message || 'Network error' }
    }
}
