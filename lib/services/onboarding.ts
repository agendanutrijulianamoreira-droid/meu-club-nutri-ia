import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/services/whatsapp'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

export class OnboardingService {
    static async sendWelcomeMessages(
        userId: string,
        tenantId: string,
        extra?: { password?: string }
    ): Promise<{ emailSent: boolean }> {
        console.log(`[Onboarding] Initiating for user ${userId} on tenant ${tenantId}`)
        let emailSent = false

        try {
            const supabaseAdmin = getSupabaseAdmin()
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('email, name, phone')
                .eq('user_id', userId)
                .single()

            const { data: tenant } = await supabaseAdmin
                .from('tenants')
                .select('brand_name, slug')
                .eq('id', tenantId)
                .single()

            if (!profile || !tenant) {
                console.error('[Onboarding] Profile or Tenant not found')
                return { emailSent: false }
            }

            const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://vitaclub.app'}/login/paciente`
            const patientName = profile.name || 'Paciente'

            if (process.env.RESEND_API_KEY) {
                emailSent = await this._sendWelcomeEmail(
                    profile.email,
                    patientName,
                    tenant.brand_name,
                    loginUrl,
                    extra?.password
                )
            } else {
                console.log('[Onboarding] RESEND_API_KEY not found, skipping email')
            }

            if (profile.phone) {
                const msg = extra?.password
                    ? `Olá *${patientName}*! 🎉\n\nSeu acesso ao *${tenant.brand_name}* foi liberado!\n\n📧 E-mail: ${profile.email}\n🔑 Senha provisória: ${extra.password}\n🔗 Acesse: ${loginUrl}\n\nSeja bem-vinda! 💎`
                    : `Olá *${patientName}*! 🎉\n\nSeu acesso ao *${tenant.brand_name}* foi liberado!\n\nAcesse: ${loginUrl}\n\nSeja bem-vinda! 💎`
                await sendWhatsApp(profile.phone, msg)
            }

        } catch (error) {
            console.error('[Onboarding] Error sending welcome messages:', error)
        }

        return { emailSent }
    }

    static async sendCredentialsEmail(
        email: string,
        name: string,
        brandName: string,
        recoveryLink: string
    ): Promise<boolean> {
        if (!process.env.RESEND_API_KEY) return false

        console.log(`[Onboarding] Sending credentials email to ${email}`)
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: `${brandName} <${FROM_EMAIL}>`,
                    to: [email],
                    subject: `Seus dados de acesso – ${brandName} 🔑`,
                    html: buildCredentialsEmail(name, email, brandName, recoveryLink),
                }),
            })
            if (!response.ok) {
                const err = await response.text()
                console.error('[Onboarding] Resend credentials error:', err)
                return false
            }
            return true
        } catch (err) {
            console.error('[Onboarding] Failed to send credentials email', err)
            return false
        }
    }

    private static async _sendWelcomeEmail(
        email: string,
        name: string,
        brandName: string,
        loginUrl: string,
        password?: string
    ): Promise<boolean> {
        console.log(`[Onboarding] Sending welcome email to ${email}`)
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: `${brandName} <${FROM_EMAIL}>`,
                    to: [email],
                    subject: `Bem-vinda ao ${brandName}! 🎉`,
                    html: buildWelcomeEmail(name, email, brandName, loginUrl, password),
                }),
            })
            if (!response.ok) {
                const err = await response.text()
                console.error('[Onboarding] Resend error:', err)
                return false
            }
            return true
        } catch (err) {
            console.error('[Onboarding] Failed to send welcome email', err)
            return false
        }
    }
}

function buildWelcomeEmail(
    name: string,
    email: string,
    brandName: string,
    loginUrl: string,
    password?: string
): string {
    return `<!DOCTYPE html>
<html>
<body style="background:#0f172a;font-family:Arial,sans-serif;margin:0;padding:20px">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px">
    <h1 style="color:white;margin:0 0 8px;font-size:22px">Bem-vinda, ${name}! 🎉</h1>
    <p style="color:#94a3b8;margin:0 0 24px;font-size:14px">
      Seu acesso ao <strong style="color:white">${brandName}</strong> está liberado.
    </p>
    <div style="background:#0f172a;border-radius:12px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:bold">Dados de acesso</p>
      <p style="margin:8px 0 4px;font-size:14px;color:#cbd5e1">📧 E-mail: <strong style="color:white">${email}</strong></p>
      ${password ? `<p style="margin:4px 0 0;font-size:14px;color:#cbd5e1">🔑 Senha provisória: <strong style="color:white;font-family:monospace;background:#0f172a;padding:2px 8px;border-radius:4px;border:1px solid #334155">${password}</strong></p>` : ''}
    </div>
    <a href="${loginUrl}" style="display:block;background:#4f46e5;color:white;padding:14px 24px;border-radius:99px;text-decoration:none;font-weight:bold;text-align:center;font-size:14px;margin-bottom:16px">
      ACESSAR AGORA →
    </a>
    ${password ? '<p style="font-size:12px;color:#64748b;text-align:center;margin:0">Recomendamos trocar a senha no primeiro acesso.</p>' : ''}
  </div>
</body>
</html>`
}

function buildCredentialsEmail(
    name: string,
    email: string,
    brandName: string,
    recoveryLink: string
): string {
    return `<!DOCTYPE html>
<html>
<body style="background:#0f172a;font-family:Arial,sans-serif;margin:0;padding:20px">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px">
    <h1 style="color:white;margin:0 0 8px;font-size:22px">Seus dados de acesso 🔑</h1>
    <p style="color:#94a3b8;margin:0 0 24px;font-size:14px">
      Olá, ${name}! Aqui estão seus dados de acesso ao <strong style="color:white">${brandName}</strong>.
    </p>
    <div style="background:#0f172a;border-radius:12px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:bold">Login</p>
      <p style="margin:8px 0 0;font-size:14px;color:#cbd5e1">📧 E-mail: <strong style="color:white">${email}</strong></p>
    </div>
    <a href="${recoveryLink}" style="display:block;background:#4f46e5;color:white;padding:14px 24px;border-radius:99px;text-decoration:none;font-weight:bold;text-align:center;font-size:14px;margin-bottom:16px">
      DEFINIR MINHA SENHA →
    </a>
    <p style="font-size:12px;color:#64748b;text-align:center;margin:0">⏱️ Este link expira em 24 horas.</p>
  </div>
</body>
</html>`
}
