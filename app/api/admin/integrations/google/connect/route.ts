import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { getVitalConfig, getVitalSecret, requireStaffIntegrationContext, jsonError } from '@/lib/integrations/vitalSettings'

export const dynamic = 'force-dynamic'

function base64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireStaffIntegrationContext()
    const [clientId, clientSecret] = await Promise.all([
      getVitalConfig(tenantId, 'google_workspace', 'CLIENT_ID'),
      getVitalSecret(tenantId, 'google_workspace', 'CLIENT_SECRET'),
    ])
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/admin/settings/vital?error=google_missing_config', req.url))
    }

    const state = base64url(randomBytes(32))
    const verifier = base64url(randomBytes(48))
    const challenge = base64url(createHash('sha256').update(verifier).digest())
    const redirectUri = `${new URL(req.url).origin}/api/admin/integrations/google/callback`
    const scopes = [
      'openid',
      'email',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive.file',
    ]

    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    auth.searchParams.set('client_id', clientId)
    auth.searchParams.set('redirect_uri', redirectUri)
    auth.searchParams.set('response_type', 'code')
    auth.searchParams.set('scope', scopes.join(' '))
    auth.searchParams.set('access_type', 'offline')
    auth.searchParams.set('prompt', 'consent')
    auth.searchParams.set('include_granted_scopes', 'true')
    auth.searchParams.set('state', state)
    auth.searchParams.set('code_challenge', challenge)
    auth.searchParams.set('code_challenge_method', 'S256')

    const res = NextResponse.redirect(auth)
    const secure = new URL(req.url).protocol === 'https:'
    res.cookies.set('google_oauth_state', state, { httpOnly: true, secure, sameSite: 'lax', maxAge: 600, path: '/' })
    res.cookies.set('google_oauth_verifier', verifier, { httpOnly: true, secure, sameSite: 'lax', maxAge: 600, path: '/' })
    return res
  } catch (error) {
    return jsonError(error)
  }
}
