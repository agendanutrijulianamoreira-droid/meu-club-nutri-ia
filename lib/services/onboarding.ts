import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export class OnboardingService {
    /**
     * Envia as boas-vindas e os dados de acesso ao paciente.
     */
    static async sendWelcomeMessages(userId: string, tenantId: string) {
        console.log(`[Onboarding] Initiating for user ${userId} on tenant ${tenantId}`)

        try {
            // 1. Buscar dados do perfil e do tenant
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
                return
            }

            const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://reino.nutri.ia'}/login`
            const patientName = profile.name || 'Paciente'
            
            // 2. Enviar E-mail via Resend (se configurado)
            if (process.env.RESEND_API_KEY) {
                await this.sendEmail(profile.email, patientName, tenant.brand_name, loginUrl)
            } else {
                console.log('[Onboarding] RESEND_API_KEY not found, skipping email')
            }

            // 3. Enviar WhatsApp via Evolution/Z-API (se configurado)
            if (process.env.WHATSAPP_API_URL && profile.phone) {
                await this.sendWhatsApp(profile.phone, patientName, tenant.brand_name, loginUrl)
            } else {
                console.log('[Onboarding] WHATSAPP_API_URL or phone not found, skipping WhatsApp')
            }

        } catch (error) {
            console.error('[Onboarding] Error sending welcome messages:', error)
        }
    }

    private static async sendEmail(email: string, name: string, brandName: string, url: string) {
        console.log(`[Onboarding] Sending email to ${email}`)
        // Mock of Resend call
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: 'Reino da Nutri <onboarding@nutri.ia>',
                    to: [email],
                    subject: `Bem-vinda ao ${brandName}! 🎉`,
                    html: `
                        <h1>Olá, ${name}!</h1>
                        <p>Seu pagamento foi confirmado e seu acesso ao <strong>${brandName}</strong> já está liberado.</p>
                        <p>Para entrar na plataforma, use o link abaixo:</p>
                        <a href="${url}" style="background-color: #9333ea; color: white; padding: 12px 24px; border-radius: 99px; text-decoration: none; font-weight: bold;">ACESSAR MINHA ÁREA</a>
                        <p>Use seu e-mail: <strong>${email}</strong></p>
                        <hr />
                        <p>Se tiver dúvidas, responda a este e-mail.</p>
                    `,
                }),
            })
            if (!response.ok) throw new Error('Resend error')
        } catch (err) {
            console.error('[Onboarding] Failed to send email via Resend')
        }
    }

    private static async sendWhatsApp(phone: string, name: string, brandName: string, url: string) {
        console.log(`[Onboarding] Sending WhatsApp to ${phone}`)
        // Mock for Evolution API or Z-API
        try {
            const message = `Olá *${name}*! 🎉\n\nSeu acesso ao *${brandName}* foi liberado!\n\nClique no link abaixo para entrar:\n${url}\n\nSeu login é seu e-mail.\n\nSeja bem-vinda! 💎`
            
            const response = await fetch(`${process.env.WHATSAPP_API_URL}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.WHATSAPP_API_KEY || '',
                },
                body: JSON.stringify({
                    number: phone.replace(/\D/g, ''),
                    text: message
                }),
            })
            if (!response.ok) throw new Error('WhatsApp API error')
        } catch (err) {
            console.error('[Onboarding] Failed to send WhatsApp')
        }
    }
}
