import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()

    // Rotas públicas — não precisa de auth
    const pathname = req.nextUrl.pathname
    if (
        pathname.includes('/checkout') ||
        pathname.startsWith('/api/webhooks') ||
        pathname.startsWith('/api/tenant-info') ||
        pathname.startsWith('/api/checkout')
    ) {
        return res
    }

    // Se as env vars não estiverem configuradas, passa sem auth (evita crash em cold start)
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
                    // Mantém request e response sincronizados para que o refresh
                    // de sessão seja visível na mesma navegação.
                    req.cookies.set({ name, value })
                    res.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    req.cookies.set({ name, value: '' })
                    res.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    // getUser() valida a sessão e força o refresh do token quando necessário.
    // Isso evita que a nutricionista seja enviada de volta ao login apenas
    // porque o access token venceu enquanto o refresh token ainda é válido.
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    const isAuthenticated = Boolean(user) && !userError

    const userMetadata = user?.user_metadata
    const userRole = userMetadata?.user_type || userMetadata?.role

    // 1. Proteger rotas /admin
    if (pathname.startsWith('/admin')) {
        if (!isAuthenticated) {
            return NextResponse.redirect(new URL('/login', req.url))
        }

        // BLOQUEIO RESTRITO: Só trava se tivermos CERTEZA que é um paciente no metadata
        if (userRole === 'patient') {
            return NextResponse.redirect(new URL('/patient/home', req.url))
        }
    }

    // 2. Proteger rotas /patient ou /dashboard
    const isPatientRoute = pathname.startsWith('/patient') || pathname.startsWith('/dashboard')
    if (isPatientRoute) {
        if (!isAuthenticated) {
            return NextResponse.redirect(new URL('/login', req.url))
        }

        if (pathname === '/dashboard' || pathname.startsWith('/dashboard')) {
            if (userRole === 'admin' || userRole === 'nutritionist' || userRole === 'nutri') {
                return NextResponse.redirect(new URL('/admin/dashboard', req.url))
            }
            return NextResponse.redirect(new URL('/patient/home', req.url))
        }
    }

    // 3. Redirecionar / (Root) se já estiver logado
    if (pathname === '/') {
        if (isAuthenticated) {
            if (userRole === 'admin' || userRole === 'nutritionist' || userRole === 'nutri') {
                return NextResponse.redirect(new URL('/admin/dashboard', req.url))
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
