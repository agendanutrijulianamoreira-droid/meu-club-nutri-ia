import { NextResponse } from 'next/server'

// Abordagem definitiva para bibliotecas CommonJS teimosas no Next.js/Turbopack
export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        console.log('PDF Route: Buffer created, size:', buffer.length)

        // Usando require direto na lib para evitar o bug de 'Debug Mode' no index.js da biblioteca
        // que tenta ler um arquivo inexistente ./test/data/05-versions-space.pdf
        const pdf = require('pdf-parse/lib/pdf-parse.js')
        const data = await pdf(buffer)
        console.log('PDF Route: Extraction successful, text length:', data.text?.length)
        const text = data.text

        return NextResponse.json({ text })
    } catch (error: any) {
        console.error('PDF Route Error:', error)
        return NextResponse.json({ error: error.message || 'Erro ao extrair texto do PDF' }, { status: 500 })
    }
}
