import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const next = requestUrl.searchParams.get('next')

    // PKCE flow: exchange the authorization code for a cookie-backed session.
    if (code) {
        const supabase = createSupabaseServerClient(cookies())
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.user) {
            // Explicit destinations are used by flows such as password recovery.
            if (next) {
                return NextResponse.redirect(new URL(next, request.url))
            }

            const userMetadata = data.user.user_metadata
            let role = userMetadata?.user_type || userMetadata?.role

            if (!role) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('user_id', data.user.id)
                    .single()
                if (profile) role = profile.role
            }

            const isAdmin = ['nutri', 'nutritionist', 'admin'].includes(role || '')
            return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/patient/home', request.url))
        }
    }

    // Legacy/implicit recovery flow: Supabase returns access tokens in the URL
    // fragment. Fragments are browser-only and never reach this Route Handler.
    // Redirect to the requested recovery page and let the browser preserve the
    // fragment so supabase-js can establish the recovery session client-side.
    if (next) {
        return NextResponse.redirect(new URL(next, request.url))
    }

    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
