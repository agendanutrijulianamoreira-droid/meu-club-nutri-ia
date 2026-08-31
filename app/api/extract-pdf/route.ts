import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { PDFParse } from 'pdf-parse'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const MAX_PDF_BYTES = 15 * 1024 * 1024

export async function POST(req: Request) {
    try {
        const supabase = createSupabaseServerClient(cookies())
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        const contentLength = Number(req.headers.get('content-length') || '0')
        if (contentLength > MAX_PDF_BYTES + 1024 * 1024) {
            return NextResponse.json({ error: 'Arquivo muito grande. Limite: 15 MB.' }, { status: 413 })
        }

        const formData = await req.formData()
        const candidate = formData.get('file')
        if (!(candidate instanceof File)) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
        }

        if (candidate.type !== 'application/pdf') {
            return NextResponse.json({ error: 'Apenas arquivos PDF são permitidos.' }, { status: 415 })
        }

        if (candidate.size <= 0 || candidate.size > MAX_PDF_BYTES) {
            return NextResponse.json({ error: 'PDF inválido ou acima do limite de 15 MB.' }, { status: 413 })
        }

        const bytes = new Uint8Array(await candidate.arrayBuffer())
        // PDF magic bytes: %PDF-. MIME alone is client-controlled.
        if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2d) {
            return NextResponse.json({ error: 'O arquivo enviado não é um PDF válido.' }, { status: 415 })
        }

        const data = await new PDFParse({ data: Buffer.from(bytes) }).getText()
        const text = String(data.text || '').slice(0, 1_000_000)

        return NextResponse.json({ text })
    } catch (error: any) {
        console.error('[extract-pdf] Error:', error)
        return NextResponse.json({ error: 'Erro ao extrair texto do PDF' }, { status: 500 })
    }
}
