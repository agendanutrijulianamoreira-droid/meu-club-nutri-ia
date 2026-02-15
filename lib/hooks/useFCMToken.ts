import { useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

// This hook handles FCM token registration for the patient
export function useFCMToken() {
    useEffect(() => {
        const setupFCM = async () => {
            // 1. Check if browser supports notifications
            if (!('Notification' in window)) return

            // 2. Request permission if not granted
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission()
                if (permission !== 'granted') return
            }

            // 3. Get FCM Token (Using Firebase SDK)
            // This requires the Firebase config to be initialized in a client-side layout or here
            // For MVP, we presume Firebase is initialized.
            try {
                // Placeholder for Firebase Messaging token retrieval
                // const messaging = getMessaging();
                // const token = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });

                const token = "MOCK_TOKEN_" + Math.random().toString(36).substring(7) // Placeholder

                if (token) {
                    await syncToken(token)
                }
            } catch (err) {
                console.error("FCM Token Error:", err)
            }
        }

        setupFCM()
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
