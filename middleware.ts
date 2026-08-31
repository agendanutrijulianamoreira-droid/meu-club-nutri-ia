import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_ROLES = ['admin', 'nutritionist', 'nutri']

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()
    const pathname = req.nextUrl.pathname

    const isProtectedUi = pathname.startsWith('/admin') || pathname.startsWith('/patient') || pathname.startsWith('/dashboard')
    const isProtectedApi = pathname.startsWith('/api/admin') || pathname.startsWith('/api/trigger-agent')

    // Recovery pages and externally signed/public endpoints.
    if (
        pathname === '/admin/reset-password' ||
        pathname === '/auth/reset-password' ||
        pathname.includes('/checkout/success') ||
        pathname.startsWith('/api/webhooks') ||
        pathname.startsWith('/api/tenant-info')
    ) {
        return res
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('[Middleware] Supabase env missing; protected route denied')

        if (isProtectedApi) {
            return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
        }

        if (isProtectedUi) {
            return new NextResponse('Service unavailable', { status: 503 })
        }

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

    // getUser() validates the access token with Supabase Auth and is the only
    // identity source accepted by route guards.
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    const currentUser = authError ? null : user

    let resolvedRole: string | null = null

    if (currentUser) {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', currentUser.id)
            .maybeSingle()

        if (!profileError && profile?.role) {
            resolvedRole = String(profile.role).toLowerCase()
        }
    }

    const isAdminRole = !!resolvedRole && ADMIN_ROLES.includes(resolvedRole)
    const isPatientRole = resolvedRole === 'patient'

    if (pathname.startsWith('/admin')) {
        if (!currentUser) {
            return NextResponse.redirect(new URL('/login/nutricionista', req.url))
        }

        if (!isAdminRole) {
            return NextResponse.redirect(new URL('/login/nutricionista?error=wrong_role', req.url))
        }
    }

    const isPatientRoute = pathname.startsWith('/patient') || pathname.startsWith('/dashboard')
    if (isPatientRoute) {
        if (!currentUser) {
            return NextResponse.redirect(new URL('/login/paciente', req.url))
        }

        if (isAdminRole) {
            return NextResponse.redirect(new URL('/admin', req.url))
        }

        if (!isPatientRole) {
            return NextResponse.redirect(new URL('/login/paciente?error=wrong_role', req.url))
        }

        if (pathname.startsWith('/dashboard')) {
            return NextResponse.redirect(new URL('/patient/home', req.url))
        }
    }

    if (pathname === '/') {
        if (currentUser && isAdminRole) {
            return NextResponse.redirect(new URL('/admin', req.url))
        }
        if (currentUser && isPatientRole) {
            return NextResponse.redirect(new URL('/patient/home', req.url))
        }
    }

    return res
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
