import { NextRequest, NextResponse } from 'next/server'
import { getVitalConfig, getVitalSecret, requireStaffIntegrationContext, saveVitalSetting, jsonError } from '@/lib/integrations/vitalSettings'

export const dynamic = 'force-dynamic'

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
  id_token?: string
  error?: string
  error_description?: string
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const providerError = url.searchParams.get('error')
    const cookieState = req.cookies.get('google_oauth_state')?.value
    const verifier = req.cookies.get('google_oauth_verifier')?.value

    if (providerError) return NextResponse.redirect(new URL(`/admin/settings/vital?error=google_${encodeURIComponent(providerError)}`, req.url))
    if (!code || !state || !cookieState || !verifier || state !== cookieState) {
      return NextResponse.redirect(new URL('/admin/settings/vital?error=google_state', req.url))
    }

    const { supabase, tenantId } = await requireStaffIntegrationContext()
    const [clientId, clientSecret] = await Promise.all([
      getVitalConfig(tenantId, 'google_workspace', 'CLIENT_ID'),
      getVitalSecret(tenantId, 'google_workspace', 'CLIENT_SECRET'),
    ])
    if (!clientId || !clientSecret) return NextResponse.redirect(new URL('/admin/settings/vital?error=google_missing_config', req.url))

    const redirectUri = `${url.origin}/api/admin/integrations/google/callback`
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      cache: 'no-store',
    })
    const tokens = await tokenRes.json() as GoogleTokenResponse
    if (!tokenRes.ok || !tokens.access_token) {
      console.error('[Google OAuth] token exchange failed', { status: tokenRes.status, error: tokens.error })
      return NextResponse.redirect(new URL('/admin/settings/vital?error=google_token', req.url))
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
    })
    const userInfo = userInfoRes.ok ? await userInfoRes.json() as { email?: string } : {}

    if (tokens.refresh_token) {
      await saveVitalSetting(supabase, {
        category: 'Produtividade', provider: 'google_workspace', key: 'REFRESH_TOKEN',
        label: 'Google Refresh Token', description: 'Token OAuth offline para sincronização de Agenda/Meet/Drive.',
        type: 'secret', value: tokens.refresh_token, required: true,
      })
    } else {
      const existingRefresh = await getVitalSecret(tenantId, 'google_workspace', 'REFRESH_TOKEN')
      if (!existingRefresh) return NextResponse.redirect(new URL('/admin/settings/vital?error=google_no_refresh_token', req.url))
    }

    await Promise.all([
      saveVitalSetting(supabase, {
        category: 'Produtividade', provider: 'google_workspace', key: 'CONNECTED_EMAIL',
        label: 'Conta Google conectada', description: 'Conta que autorizou Calendar, Meet e Drive.',
        type: 'text', value: userInfo.email || 'conectada',
      }),
      saveVitalSetting(supabase, {
        category: 'Produtividade', provider: 'google_workspace', key: 'SCOPES',
        label: 'Escopos autorizados', description: 'Escopos OAuth efetivamente concedidos pelo Google.',
        type: 'text', value: tokens.scope || '',
      }),
    ])

    const res = NextResponse.redirect(new URL('/admin/settings/vital?google=connected', req.url))
    res.cookies.set('google_oauth_state', '', { maxAge: 0, path: '/' })
    res.cookies.set('google_oauth_verifier', '', { maxAge: 0, path: '/' })
    return res
  } catch (error) {
    console.error('[Google OAuth] callback error', error)
    return jsonError(error)
  }
}
