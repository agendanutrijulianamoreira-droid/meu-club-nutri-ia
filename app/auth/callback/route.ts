import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const supabase = createSupabaseServerClient(cookies())

        // Exchange code for session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.user) {
            const next = requestUrl.searchParams.get('next')
            if (next) {
                return NextResponse.redirect(new URL(next, request.url))
            }

            const userMetadata = data.user.user_metadata;
            let role = userMetadata?.user_type || userMetadata?.role;

            if (!role) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('user_id', data.user.id)
                    .single();
                if (profile) role = profile.role;
            }

            const isAdmin = ['nutri', 'nutritionist', 'admin'].includes(role || '');
            return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/patient/home', request.url))
        }
    }

    // Fallback URL
    return NextResponse.redirect(new URL('/dashboard', request.url))
}
