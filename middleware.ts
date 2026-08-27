import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_ROLES = ['admin', 'nutritionist', 'nutri']

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()
    const pathname = req.nextUrl.pathname

    // Public routes. Recovery pages must render before the browser establishes
    // the recovery session from the URL fragment/code.
    if (
        pathname === '/admin/reset-password' ||
        pathname === '/auth/reset-password' ||
        pathname.includes('/checkout') ||
        pathname.startsWith('/api/webhooks') ||
        pathname.startsWith('/api/tenant-info') ||
        pathname.startsWith('/api/checkout')
    ) {
        return res
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('[Middleware] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não configurados no Vercel')
        return res
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    res.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    res.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    // Refresh/validate the Supabase session before route guards.
    const { data: { user } } = await supabase.auth.getUser()
    const { data: { session } } = await supabase.auth.getSession()
    const currentUser = user || session?.user || null

    let resolvedRole: string | null = null

    if (currentUser) {
        // Authorization source of truth: profiles.role in the database.
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', currentUser.id)
            .maybeSingle()

        resolvedRole = String(profile?.role || currentUser.app_metadata?.role || '').toLowerCase() || null
    }

    const isAdminRole = !!resolvedRole && ADMIN_ROLES.includes(resolvedRole)
    const isPatientRole = resolvedRole === 'patient'

    if (pathname.startsWith('/admin')) {
        if (!currentUser) {
            return NextResponse.redirect(new URL('/login/nutricionista', req.url))
        }

        if (!isAdminRole) {
            return NextResponse.redirect(new URL('/patient/home', req.url))
        }
    }

    const isPatientRoute = pathname.startsWith('/patient') || pathname.startsWith('/dashboard')
    if (isPatientRoute) {
        if (!currentUser) {
            return NextResponse.redirect(new URL('/login/paciente', req.url))
        }

        // A nutritionist/admin can never remain inside the patient portal.
        if (isAdminRole) {
            return NextResponse.redirect(new URL('/admin', req.url))
        }

        if (!isPatientRole && resolvedRole) {
            return NextResponse.redirect(new URL('/login/paciente?error=wrong_role', req.url))
        }

        if (pathname.startsWith('/dashboard')) {
            return NextResponse.redirect(new URL('/patient/home', req.url))
        }
    }

    if (pathname === '/') {
        if (currentUser) {
            if (isAdminRole) {
                return NextResponse.redirect(new URL('/admin', req.url))
            }
            if (isPatientRole) {
                return NextResponse.redirect(new URL('/patient/home', req.url))
            }
        }
    }

    return res
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
