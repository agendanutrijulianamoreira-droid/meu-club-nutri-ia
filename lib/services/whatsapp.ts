/**
 * Evolution API v2 helper
 *
 * Variáveis de ambiente necessárias:
 *   EVOLUTION_API_URL      → URL base da sua instância (ex: https://evo.seudominio.com)
 *   EVOLUTION_API_KEY      → API Key global definida no .env da Evolution
 *   EVOLUTION_INSTANCE     → Nome da instância criada no painel (ex: vitaclub)
 */

function getConfig() {
    return {
        url: process.env.EVOLUTION_API_URL?.replace(/\/$/, ''),
        key: process.env.EVOLUTION_API_KEY,
        instance: process.env.EVOLUTION_INSTANCE,
    }
}

/**
 * Envia uma mensagem de texto via Evolution API.
 * Retorna true se enviou, false se a configuração está incompleta ou houve erro.
 */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
    const { url, key, instance } = getConfig()
    if (!url || !key || !instance) {
        console.log('[WhatsApp] Evolution API não configurada — pulando envio')
        return false
    }

    // Normaliza o número: apenas dígitos, com DDI 55
    const number = '55' + phone.replace(/\D/g, '').replace(/^55/, '')

    try {
        const res = await fetch(`${url}/message/sendText/${instance}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': key,
            },
            body: JSON.stringify({ number, text: message }),
        })

        if (!res.ok) {
            const body = await res.text()
            console.error('[WhatsApp] Evolution API error:', res.status, body)
            return false
        }

        return true
    } catch (err) {
        console.error('[WhatsApp] Falha ao enviar:', err)
        return false
    }
}
