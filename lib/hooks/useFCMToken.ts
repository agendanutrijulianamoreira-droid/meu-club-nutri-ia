import { useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

// This hook handles FCM token registration for the patient
export function useFCMToken() {
    useEffect(() => {
        // Notification logic disabled for MVP (Inbox priority)
        return
    }, [])

    const syncToken = async (token: string) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('user_id', session.user.id).single()

        const { error } = await supabase
            .from('device_tokens')
            .upsert({
                user_id: session.user.id,
                tenant_id: profile?.tenant_id,
                platform: 'web',
                token: token,
                last_seen_at: new Date().toISOString()
            }, { onConflict: 'user_id, token' })

        if (error) console.error("Error syncing FCM token:", error)
    }
}
