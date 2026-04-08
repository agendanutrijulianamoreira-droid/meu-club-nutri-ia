'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase-browser'

declare global {
    interface Window {
        OneSignal?: any
    }
}

/**
 * Client-side hook that initializes the OneSignal Web SDK.
 * - Loads the SDK via script tag (avoids npm bundle bloat)
 * - Registers the user's external_user_id (our auth user_id)
 * - Handles notification permission prompts
 * - Saves the OneSignal player_id to the profiles table
 *
 * Call this once in a top-level layout (e.g. PatientLayout).
 */
export function useOneSignal() {
    const initialized = useRef(false)

    useEffect(() => {
        if (initialized.current) return
        initialized.current = true

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
        if (!appId) {
            console.error('[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID not set')
            return
        }

        // Avoid double-loading
        if (window.OneSignal) {
            registerUser(appId)
            return
        }

        loadOneSignalSDK(appId)
    }, [])
}

function loadOneSignalSDK(appId: string) {
    // OneSignal requires this global array before the script loads
    window.OneSignal = window.OneSignal || []

    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.async = true
    script.defer = true

    script.onload = () => {
        registerUser(appId)
    }

    script.onerror = () => {
        console.error('[OneSignal] Failed to load SDK script')
    }

    document.head.appendChild(script)
}

async function registerUser(appId: string) {
    try {
        const OneSignal = window.OneSignal

        if (!OneSignal) return

        // OneSignal Web SDK v16+ uses the new init pattern
        await OneSignal.init({
            appId,
            allowLocalhostAsSecureOrigin: process.env.NODE_ENV === 'development',
            notifyButton: {
                enable: true,
            },
        })

        // Get the current Supabase user and set as external user ID
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return

        const userId = session.user.id

        // Set external user ID so server-side can target by our user_id
        await OneSignal.login(userId)

        // Listen for subscription change to save player_id to profiles
        OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
            const playerId = event.current?.id
            if (playerId) {
                savePlayerIdToProfile(userId, playerId)
            }
        })

        // Also try to save the current player ID immediately
        const currentPlayerId = OneSignal.User.PushSubscription.id
        if (currentPlayerId) {
            savePlayerIdToProfile(userId, currentPlayerId)
        }
    } catch (err) {
        console.error('[OneSignal] Initialization error:', err)
    }
}

async function savePlayerIdToProfile(userId: string, playerId: string) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ onesignal_player_id: playerId })
            .eq('user_id', userId)

        if (error) {
            console.error('[OneSignal] Error saving player_id to profile:', error)
        }
    } catch (err) {
        console.error('[OneSignal] Error saving player_id:', err)
    }
}
