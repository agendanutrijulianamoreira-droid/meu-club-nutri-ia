import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()

    const pathname = req.nextUrl.pathname

    // Public routes — password recovery must render before the browser can
    // consume an implicit-flow URL fragment and establish the session.
    if (
        pathname === '/admin/reset-password' ||
        pathname.includes('/checkout') ||
        pathname.startsWith('/api/webhooks') ||
        pathname.startsWith('/api/tenant-info') ||
        pathname.startsWith('/api/checkout')
    ) {
        return res
    }

    // If env vars are missing, do not crash during cold start.
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

    // Refresh/validate auth before applying route guards.
    const { data: { user } } = await supabase.auth.getUser()
    const { data: { session } } = await supabase.auth.getSession()

    const userMetadata = user?.user_metadata || session?.user?.user_metadata
    const userRole = userMetadata?.user_type || userMetadata?.role

    if (pathname.startsWith('/admin')) {
        if (!user && !session) {
            return NextResponse.redirect(new URL('/login', req.url))
        }

        if (userRole === 'patient') {
            return NextResponse.redirect(new URL('/patient/home', req.url))
        }
    }

    const isPatientRoute = pathname.startsWith('/patient') || pathname.startsWith('/dashboard')
    if (isPatientRoute) {
        if (!user && !session) {
            return NextResponse.redirect(new URL('/login', req.url))
        }

        if (pathname === '/dashboard' || pathname.startsWith('/dashboard')) {
            if (userRole === 'admin' || userRole === 'nutritionist' || userRole === 'nutri') {
                return NextResponse.redirect(new URL('/admin', req.url))
            }
            return NextResponse.redirect(new URL('/patient/home', req.url))
        }
    }

    if (pathname === '/') {
        if (user || session) {
            if (userRole === 'admin' || userRole === 'nutritionist' || userRole === 'nutri') {
                return NextResponse.redirect(new URL('/admin', req.url))
            }
            if (userRole === 'patient') {
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
