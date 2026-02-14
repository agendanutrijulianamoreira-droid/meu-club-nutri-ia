import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    res.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    res.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    // Refresh session if expired - required for Server Components
    const { data: { session } } = await supabase.auth.getSession()

    // 1. Proteger rotas /admin
    if (req.nextUrl.pathname.startsWith('/admin')) {
        if (!session) {
            return NextResponse.redirect(new URL('/login', req.url))
        }

        // Buscar papel do usuário
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', session.user.id)
            .single()

        if (!profile || (profile.role !== 'admin' && profile.role !== 'nutritionist')) {
            // Se for paciente tentando entrar no admin, manda pro dashboard do paciente
            return NextResponse.redirect(new URL('/patient/home', req.url))
        }
    }

    // 2. Proteger rotas /patient ou /dashboard
    const isPatientRoute = req.nextUrl.pathname.startsWith('/patient') || req.nextUrl.pathname.startsWith('/dashboard')
    if (isPatientRoute) {
        if (!session) {
            return NextResponse.redirect(new URL('/login', req.url))
        }

        // Se acessar /dashboard, redireciona baseado no papel
        if (req.nextUrl.pathname === '/dashboard' || req.nextUrl.pathname.startsWith('/dashboard')) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('user_id', session.user.id)
                .single()

            if (profile?.role === 'admin' || profile?.role === 'nutritionist') {
                return NextResponse.redirect(new URL('/admin', req.url))
            }

            return NextResponse.redirect(new URL('/patient/home', req.url))
        }
    }

    return res
}

// Ensure middleware is only called for relevant paths
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
