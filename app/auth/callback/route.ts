import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_ROLES = ['nutri', 'nutritionist', 'admin']

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const next = requestUrl.searchParams.get('next')

    if (code) {
        const supabase = createSupabaseServerClient(cookies())
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('user_id', data.user.id)
                .maybeSingle()

            const role = String(profile?.role || data.user.app_metadata?.role || '').toLowerCase()
            const isAdmin = ADMIN_ROLES.includes(role)
            const isPatient = role === 'patient'

            // Password recovery keeps separate destinations for professional and patient accounts.
            if (next?.includes('reset-password')) {
                const recoveryDestination = isAdmin
                    ? '/admin/reset-password'
                    : '/auth/reset-password'
                return NextResponse.redirect(new URL(recoveryDestination, request.url))
            }

            if (isAdmin) {
                return NextResponse.redirect(new URL('/admin', request.url))
            }

            if (isPatient) {
                return NextResponse.redirect(new URL('/patient/home', request.url))
            }

            // Unknown role: do not guess which portal the user belongs to.
            return NextResponse.redirect(new URL('/login?error=role_not_configured', request.url))
        }
    }

    // In the implicit recovery flow the access token lives in the URL fragment,
    // which the server cannot read. Preserve the requested recovery destination;
    // once the browser establishes the session, route guards enforce the DB role.
    if (next?.includes('reset-password')) {
        return NextResponse.redirect(new URL(next, request.url))
    }

    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
